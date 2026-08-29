import crypto from 'node:crypto';

const present=v=>v!==null&&v!==undefined&&v!=='';
const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const finite=v=>present(v)&&Number.isFinite(Number(v));
const nonNegativeOrNull=v=>present(v)&&finite(v)&&Number(v)>=0?Number(v):null;
const positiveOrNull=v=>present(v)&&finite(v)&&Number(v)>0?Number(v):null;
const iso=v=>{if(!clean(v))return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();};
const uniqueStrings=a=>[...new Set((Array.isArray(a)?a:[]).map(clean).filter(Boolean))];
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');

export function listingIdentityKey({marketplace,externalProductId}={}){
  const m=upper(marketplace),id=clean(externalProductId);
  return m&&id?`${m}:${id}`:null;
}

export function normalizeMarketplaceListingSnapshot(input={}){
  const marketplace=upper(input.marketplace??input.platform);
  const externalProductId=clean(input.externalProductId??input.externalId??input.marketplaceListingId);
  const sourceUrl=clean(input.sourceUrl??input.url);
  const observedAt=iso(input.observedAt);
  const currency=upper(input.currency)||null;
  const price=positiveOrNull(input.price??input.priceGross);
  const shipping=present(input.shipping??input.shippingPrice)?nonNegativeOrNull(input.shipping??input.shippingPrice):null;
  const rating=finite(input.rating)?Number(input.rating):null;
  const reviewCount=present(input.reviewCount)?nonNegativeOrNull(input.reviewCount):null;
  const canonicalProductId=clean(input.canonicalProductId)||null;
  const blockers=[];
  if(!marketplace)blockers.push('MARKETPLACE_REQUIRED');
  if(!externalProductId)blockers.push('EXTERNAL_PRODUCT_ID_REQUIRED');
  if(!sourceUrl)blockers.push('SOURCE_URL_REQUIRED');
  if(!observedAt)blockers.push('OBSERVED_AT_REQUIRED');
  if(present(input.price??input.priceGross)&&price===null)blockers.push('INVALID_PRICE');
  if(present(input.shipping??input.shippingPrice)&&shipping===null)blockers.push('INVALID_SHIPPING');
  if(present(input.reviewCount)&&reviewCount===null)blockers.push('INVALID_REVIEW_COUNT');
  if(rating!==null&&(rating<0||rating>5))blockers.push('INVALID_RATING');

  const listingKey=listingIdentityKey({marketplace,externalProductId});
  const snapshotKey=listingKey&&observedAt?`mps1_${sha(`${listingKey}|${observedAt}`).slice(0,24)}`:null;
  return {
    schemaVersion:'MPR_MARKETPLACE_LISTING_SNAPSHOT_V1',
    valid:blockers.length===0,
    blockers,
    listingKey,
    snapshotKey,
    marketplace,
    sourceUrl:sourceUrl||null,
    externalProductId:externalProductId||null,
    canonicalProductId,
    canonicalIdentityStatus:canonicalProductId?'RESOLVED':'UNRESOLVED',
    title:clean(input.title)||null,
    brand:clean(input.brand)||null,
    category:clean(input.category)||null,
    price,
    currency,
    shipping,
    availability:clean(input.availability)||null,
    rating,
    reviewCount,
    rankSignals:Array.isArray(input.rankSignals)?input.rankSignals.filter(Boolean):[],
    imageUrls:uniqueStrings(input.imageUrls),
    observedAt,
    evidenceClass:clean(input.evidenceClass)||'PUBLIC_MARKETPLACE_LISTING',
    sourceKey:clean(input.sourceKey)||null,
    extractionMethod:clean(input.extractionMethod)||null,
    provenance:input.provenance&&typeof input.provenance==='object'?input.provenance:{},
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSales:false,
    truthPolicy:{
      unknownEqualsZero:false,
      reviewCountIsVerifiedSales:false,
      rankSignalIsVerifiedSales:false,
      sourceScopedListingIdentityIsCrossMarketCanonicalIdentity:false,
      unresolvedCanonicalIdentityMayBeInvented:false,
      purchaseAuthorized:false
    }
  };
}

export function adaptAmazonLiveRefreshObservation(row={}){
  return normalizeMarketplaceListingSnapshot({
    marketplace:'AMAZON',
    externalProductId:row.externalId??row.asin,
    sourceUrl:row.url??row.sourceUrl,
    canonicalProductId:row.canonicalProductId,
    title:row.title,
    brand:row.brand,
    category:row.category,
    price:row.price,
    currency:row.currency,
    shipping:row.shipping,
    availability:row.availability,
    rating:row.rating,
    reviewCount:row.reviewCount,
    rankSignals:row.rankSignals??(present(row.sourceRank)?[{type:'SOURCE_RANK',rank:Number(row.sourceRank)}]:[]),
    imageUrls:row.imageUrls,
    observedAt:row.observedAt,
    evidenceClass:row.evidenceClass??'LIVE_PUBLIC_PRODUCT_PAGE',
    sourceKey:row.sourceKey??'AMAZON_LIVE_PUBLIC_PAGE',
    extractionMethod:row.extractionMethod??'DIRECT_PUBLIC_PAGE',
    provenance:row.provenance
  });
}

function mergeKnownText(snapshots,field){
  for(let i=snapshots.length-1;i>=0;i--)if(present(snapshots[i]?.[field]))return snapshots[i][field];
  return null;
}

export function buildMarketplacePriceLedger(inputs=[]){
  const normalized=(Array.isArray(inputs)?inputs:[]).map(x=>x?.schemaVersion==='MPR_MARKETPLACE_LISTING_SNAPSHOT_V1'?x:normalizeMarketplaceListingSnapshot(x));
  const rejected=normalized.filter(x=>!x.valid);
  const valid=normalized.filter(x=>x.valid);
  const dedupedBySnapshot=new Map();
  for(const row of valid)if(!dedupedBySnapshot.has(row.snapshotKey))dedupedBySnapshot.set(row.snapshotKey,row);
  const snapshots=[...dedupedBySnapshot.values()].sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.listingKey.localeCompare(b.listingKey));
  const groups=new Map();
  for(const row of snapshots){if(!groups.has(row.listingKey))groups.set(row.listingKey,[]);groups.get(row.listingKey).push(row);}
  const listings=[...groups.entries()].map(([listingKey,rows])=>{
    const chronological=[...rows].sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
    const canonicalIds=[...new Set(chronological.map(x=>x.canonicalProductId).filter(Boolean))];
    return {
      schemaVersion:'MPR_MARKETPLACE_LISTING_LEDGER_V1',
      listingKey,
      marketplace:chronological[0].marketplace,
      externalProductId:chronological[0].externalProductId,
      canonicalProductId:canonicalIds.length===1?canonicalIds[0]:null,
      canonicalIdentityStatus:canonicalIds.length===1?'RESOLVED':canonicalIds.length>1?'CONFLICT':'UNRESOLVED',
      canonicalIdentityCandidates:canonicalIds,
      sourceUrl:mergeKnownText(chronological,'sourceUrl'),
      title:mergeKnownText(chronological,'title'),
      brand:mergeKnownText(chronological,'brand'),
      category:mergeKnownText(chronological,'category'),
      firstSeenAt:chronological[0].observedAt,
      lastSeenAt:chronological.at(-1).observedAt,
      snapshotCount:chronological.length,
      snapshots:chronological
    };
  }).sort((a,b)=>a.listingKey.localeCompare(b.listingKey));
  const canonicalGroups=new Map();
  for(const listing of listings){
    if(!listing.canonicalProductId)continue;
    if(!canonicalGroups.has(listing.canonicalProductId))canonicalGroups.set(listing.canonicalProductId,[]);
    canonicalGroups.get(listing.canonicalProductId).push(listing.listingKey);
  }
  return {
    schemaVersion:'MPR_MARKETPLACE_PRICE_LEDGER_V1',
    listingCount:listings.length,
    canonicalProductCount:canonicalGroups.size,
    unresolvedCanonicalListingCount:listings.filter(x=>x.canonicalIdentityStatus==='UNRESOLVED').length,
    canonicalConflictListingCount:listings.filter(x=>x.canonicalIdentityStatus==='CONFLICT').length,
    snapshotCount:snapshots.length,
    rejectedCount:rejected.length,
    duplicateSnapshotCount:valid.length-snapshots.length,
    listings,
    canonicalProducts:[...canonicalGroups.entries()].map(([canonicalProductId,listingKeys])=>({canonicalProductId,listingKeys:[...listingKeys].sort()})).sort((a,b)=>a.canonicalProductId.localeCompare(b.canonicalProductId)),
    rejected,
    truthPolicy:{
      unknownEqualsZero:false,
      listingDeduplicationIsCanonicalProductDeduplication:false,
      reviewOrRankEqualsVerifiedSales:false,
      unresolvedCanonicalIdentityMayBeInvented:false,
      purchaseAuthorized:false
    }
  };
}
