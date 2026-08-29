const clean=v=>String(v??'').trim();
const present=v=>v!==null&&v!==undefined&&v!=='';
const positive=v=>present(v)&&Number.isFinite(Number(v))&&Number(v)>0;
const finite=v=>present(v)&&Number.isFinite(Number(v));

function latestMarketplaceSnapshot(listing={}){
  const rows=Array.isArray(listing.snapshots)?listing.snapshots:[];
  return rows.length?rows.at(-1):null;
}

function normalizeMarketplaceListing(listing={}){
  const latest=latestMarketplaceSnapshot(listing)||listing;
  const canonicalProductId=clean(listing.canonicalProductId||latest.canonicalProductId)||null;
  const price=positive(latest.price??latest.priceGross)?Number(latest.price??latest.priceGross):null;
  const currency=clean(latest.currency).toUpperCase()||null;
  const sourceUrl=clean(latest.sourceUrl||listing.sourceUrl)||null;
  const observedAt=clean(latest.observedAt||listing.lastSeenAt)||null;
  const blockers=[];
  if(!canonicalProductId)blockers.push('MARKETPLACE_CANONICAL_ID_UNRESOLVED');
  if(price===null)blockers.push('MARKETPLACE_PRICE_MISSING');
  if(!currency)blockers.push('MARKETPLACE_CURRENCY_MISSING');
  if(!sourceUrl)blockers.push('MARKETPLACE_SOURCE_URL_MISSING');
  if(!observedAt)blockers.push('MARKETPLACE_OBSERVED_AT_MISSING');
  return {listingKey:clean(listing.listingKey)||null,canonicalProductId,price,currency,sourceUrl,observedAt,priceReady:blockers.length===0,blockers};
}

function normalizeSupplierListing(listing={}){
  const latest=Array.isArray(listing.snapshots)&&listing.snapshots.length?listing.snapshots.at(-1):listing;
  const canonicalProductId=clean(listing.linkedMarketplaceCanonicalProductId||latest.linkedMarketplaceCanonicalProductId)||null;
  const price=positive(latest.normalizedPublicUnitPrice??listing.latestNormalizedPublicUnitPrice)?Number(latest.normalizedPublicUnitPrice??listing.latestNormalizedPublicUnitPrice):null;
  const currency=clean(latest.currency||listing.latestCurrency).toUpperCase()||null;
  const sourceUrl=clean(latest.sourceUrl||listing.sourceUrl)||null;
  const observedAt=clean(latest.observedAt||listing.lastSeenAt)||null;
  const blockers=[];
  if(!canonicalProductId)blockers.push('SUPPLIER_MARKETPLACE_LINK_UNRESOLVED');
  if(price===null)blockers.push('SUPPLIER_PUBLIC_PRICE_MISSING');
  if(!currency)blockers.push('SUPPLIER_CURRENCY_MISSING');
  if(!sourceUrl)blockers.push('SUPPLIER_SOURCE_URL_MISSING');
  if(!observedAt)blockers.push('SUPPLIER_OBSERVED_AT_MISSING');
  return {listingKey:clean(listing.listingKey)||null,canonicalProductId,price,currency,sourceUrl,observedAt,priceReady:blockers.length===0,blockers};
}

function collectListings(docs=[],schema,listKey){
  const out=[];
  for(const doc of Array.isArray(docs)?docs:[]){
    if(!doc||typeof doc!=='object')continue;
    if(doc.schemaVersion===schema&&Array.isArray(doc[listKey]))out.push(...doc[listKey]);
  }
  return out;
}

export function assessPricePairReadiness({marketplaceDocuments=[],supplierDocuments=[],matchRecords=[]}={}){
  const marketplaceListings=collectListings(marketplaceDocuments,'MPR_MARKETPLACE_PRICE_LEDGER_V1','listings').map(normalizeMarketplaceListing);
  const supplierListings=collectListings(supplierDocuments,'MPR_SUPPLIER_PRICE_LEDGER_V1','listings').map(normalizeSupplierListing);
  const marketplaceReady=marketplaceListings.filter(x=>x.priceReady);
  const supplierReady=supplierListings.filter(x=>x.priceReady);

  const marketByCanonical=new Map();
  for(const row of marketplaceReady){if(!marketByCanonical.has(row.canonicalProductId))marketByCanonical.set(row.canonicalProductId,[]);marketByCanonical.get(row.canonicalProductId).push(row);}
  const supplierByCanonical=new Map();
  for(const row of supplierReady){if(!supplierByCanonical.has(row.canonicalProductId))supplierByCanonical.set(row.canonicalProductId,[]);supplierByCanonical.get(row.canonicalProductId).push(row);}

  const matchByPair=new Map();
  for(const row of Array.isArray(matchRecords)?matchRecords:[]){
    const m=clean(row.marketplaceListingKey),s=clean(row.supplierListingKey);
    if(!m||!s)continue;
    matchByPair.set(`${m}|${s}`,finite(row.matchConfidence)?Number(row.matchConfidence):null);
  }

  const pairs=[];
  for(const [canonicalProductId,markets] of marketByCanonical){
    const suppliers=supplierByCanonical.get(canonicalProductId)||[];
    for(const market of markets)for(const supplier of suppliers){
      const matchConfidence=matchByPair.get(`${market.listingKey}|${supplier.listingKey}`)??null;
      const blockers=[];
      if(matchConfidence===null)blockers.push('MATCH_CONFIDENCE_MISSING');
      else if(matchConfidence<80)blockers.push('MATCH_CONFIDENCE_BELOW_80');
      pairs.push({canonicalProductId,marketplaceListingKey:market.listingKey,supplierListingKey:supplier.listingKey,marketplacePrice:market.price,marketplaceCurrency:market.currency,supplierPublicPrice:supplier.price,supplierCurrency:supplier.currency,matchConfidence,pricePairReady:true,screeningEconomicsReady:blockers.length===0,blockers});
    }
  }

  const blockerCounts={};
  for(const row of [...marketplaceListings,...supplierListings,...pairs])for(const blocker of row.blockers||[])blockerCounts[blocker]=(blockerCounts[blocker]||0)+1;
  const pairedCanonicalIds=[...new Set(pairs.map(x=>x.canonicalProductId))];
  return {
    schemaVersion:'MPR_PRICE_PAIR_READINESS_V1',
    marketplace:{listings:marketplaceListings.length,priceReady:marketplaceReady.length,canonicalProductsWithPrice:new Set(marketplaceReady.map(x=>x.canonicalProductId)).size},
    supplier:{listings:supplierListings.length,priceReady:supplierReady.length,canonicalProductsWithPrice:new Set(supplierReady.map(x=>x.canonicalProductId)).size},
    pairs:{pricePairCount:pairs.length,pairedCanonicalProductCount:pairedCanonicalIds.length,screeningEconomicsReadyCount:pairs.filter(x=>x.screeningEconomicsReady).length,rows:pairs},
    blockerCounts,
    truthPolicy:{catalogueDiscoveryWithoutPriceIsPriceEvidence:false,canonicalLinkWithoutMatchConfidenceIsScreeningReady:false,unknownEqualsZero:false,pricePairIsConfirmedLandedEconomics:false,verifiedSales:false,purchaseAuthorized:false}
  };
}
