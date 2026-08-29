import crypto from 'node:crypto';
import {normalizeSupplierPriceObservation} from './public-price-observation-v1.js';

const clean=v=>String(v??'').trim();
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const unique=a=>[...new Set((Array.isArray(a)?a:[]).map(clean).filter(Boolean))];

export function supplierListingIdentityKey({platform,supplierListingId}={}){
  const p=clean(platform).toUpperCase(),id=clean(supplierListingId);
  return p&&id?`${p}:${id}`:null;
}

export function normalizeSupplierCandidatePriceSnapshot(input={}){
  const priceObservation=normalizeSupplierPriceObservation(input);
  const linkedMarketplaceCanonicalProductId=clean(input.linkedMarketplaceCanonicalProductId)||null;
  const supplierFingerprintId=clean(input.supplierFingerprintId)||null;
  const variantAttributes=input.variantAttributes&&typeof input.variantAttributes==='object'?input.variantAttributes:{};
  const listingKey=supplierListingIdentityKey(priceObservation);
  const snapshotKey=listingKey&&priceObservation.observedAt?`sps1_${sha(`${listingKey}|${priceObservation.observedAt}`).slice(0,24)}`:null;
  return {
    schemaVersion:'MPR_SUPPLIER_CANDIDATE_PRICE_SNAPSHOT_V1',
    valid:priceObservation.valid,
    blockers:[...priceObservation.blockers],
    listingKey,
    snapshotKey,
    platform:priceObservation.platform,
    supplierListingId:priceObservation.supplierListingId,
    supplierName:priceObservation.supplierName,
    sourceUrl:priceObservation.sourceUrl,
    title:clean(input.title)||null,
    linkedMarketplaceCanonicalProductId,
    marketplaceLinkStatus:linkedMarketplaceCanonicalProductId?'LINKED':'UNRESOLVED',
    supplierFingerprintId,
    variantAttributes,
    currency:priceObservation.currency,
    publicPriceMin:priceObservation.publicPriceMin,
    publicPriceMax:priceObservation.publicPriceMax,
    priceTiers:priceObservation.priceTiers,
    moq:priceObservation.moq,
    targetOrderQuantity:priceObservation.targetOrderQuantity,
    priceUnit:priceObservation.priceUnit,
    normalizedPublicUnitPrice:priceObservation.normalizedPublicUnitPrice,
    supplierPriceRuleUsed:priceObservation.supplierPriceRuleUsed,
    supplierPriceConfidence:priceObservation.supplierPriceConfidence,
    moqCompatible:priceObservation.moqCompatible,
    observedAt:priceObservation.observedAt,
    evidenceClass:'PUBLIC_SUPPLIER_LISTING',
    verifiedQuote:false,
    negotiatedPriceIncluded:false,
    landedCostConfirmed:false,
    truthPolicy:{
      publicListingIsVerifiedQuote:false,
      publicSupplierPriceIsLandedCost:false,
      negotiationIncludedInBaseline:false,
      ambiguousRangeUsesAutomaticMinimum:false,
      unknownEqualsZero:false,
      unresolvedMarketplaceLinkMayBeInvented:false,
      purchaseAuthorized:false
    }
  };
}

export function buildSupplierPriceLedger(inputs=[]){
  const normalized=(Array.isArray(inputs)?inputs:[]).map(x=>x?.schemaVersion==='MPR_SUPPLIER_CANDIDATE_PRICE_SNAPSHOT_V1'?x:normalizeSupplierCandidatePriceSnapshot(x));
  const rejected=normalized.filter(x=>!x.valid);
  const valid=normalized.filter(x=>x.valid);
  const snapshotsByKey=new Map();
  for(const row of valid)if(!snapshotsByKey.has(row.snapshotKey))snapshotsByKey.set(row.snapshotKey,row);
  const snapshots=[...snapshotsByKey.values()].sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.listingKey.localeCompare(b.listingKey));
  const groups=new Map();
  for(const row of snapshots){if(!groups.has(row.listingKey))groups.set(row.listingKey,[]);groups.get(row.listingKey).push(row);}
  const listings=[...groups.entries()].map(([listingKey,rows])=>{
    const chronological=[...rows].sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
    const links=unique(chronological.map(x=>x.linkedMarketplaceCanonicalProductId));
    return {
      schemaVersion:'MPR_SUPPLIER_PRICE_LISTING_LEDGER_V1',
      listingKey,
      platform:chronological[0].platform,
      supplierListingId:chronological[0].supplierListingId,
      supplierName:[...chronological].reverse().find(x=>x.supplierName)?.supplierName??null,
      sourceUrl:chronological.at(-1).sourceUrl,
      title:[...chronological].reverse().find(x=>x.title)?.title??null,
      linkedMarketplaceCanonicalProductId:links.length===1?links[0]:null,
      marketplaceLinkStatus:links.length===1?'LINKED':links.length>1?'CONFLICT':'UNRESOLVED',
      marketplaceLinkCandidates:links,
      firstSeenAt:chronological[0].observedAt,
      lastSeenAt:chronological.at(-1).observedAt,
      snapshotCount:chronological.length,
      latestNormalizedPublicUnitPrice:chronological.at(-1).normalizedPublicUnitPrice,
      latestCurrency:chronological.at(-1).currency,
      latestMoq:chronological.at(-1).moq,
      snapshots:chronological
    };
  }).sort((a,b)=>a.listingKey.localeCompare(b.listingKey));
  const byMarketplaceCanonical=new Map();
  for(const listing of listings){
    if(!listing.linkedMarketplaceCanonicalProductId)continue;
    if(!byMarketplaceCanonical.has(listing.linkedMarketplaceCanonicalProductId))byMarketplaceCanonical.set(listing.linkedMarketplaceCanonicalProductId,[]);
    byMarketplaceCanonical.get(listing.linkedMarketplaceCanonicalProductId).push(listing.listingKey);
  }
  return {
    schemaVersion:'MPR_SUPPLIER_PRICE_LEDGER_V1',
    supplierListingCount:listings.length,
    snapshotCount:snapshots.length,
    linkedMarketplaceCanonicalProductCount:byMarketplaceCanonical.size,
    unresolvedMarketplaceLinkCount:listings.filter(x=>x.marketplaceLinkStatus==='UNRESOLVED').length,
    marketplaceLinkConflictCount:listings.filter(x=>x.marketplaceLinkStatus==='CONFLICT').length,
    rejectedCount:rejected.length,
    duplicateSnapshotCount:valid.length-snapshots.length,
    listings,
    marketplaceLinks:[...byMarketplaceCanonical.entries()].map(([canonicalProductId,supplierListingKeys])=>({canonicalProductId,supplierListingKeys:[...supplierListingKeys].sort()})).sort((a,b)=>a.canonicalProductId.localeCompare(b.canonicalProductId)),
    rejected,
    truthPolicy:{
      publicListingIsVerifiedQuote:false,
      publicSupplierPriceIsLandedCost:false,
      negotiationIncludedInBaseline:false,
      ambiguousRangeUsesAutomaticMinimum:false,
      unknownEqualsZero:false,
      catalogueDiscoveryWithoutPriceIsPriceEvidence:false,
      purchaseAuthorized:false
    }
  };
}
