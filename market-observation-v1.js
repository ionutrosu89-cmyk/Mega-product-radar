import {isCanonicalProductId,normalizeEvidenceClass} from './domain-contracts-v1.js';

const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const iso=v=>{const t=Date.parse(text(v));return Number.isFinite(t)?new Date(t).toISOString():null;};
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const https=v=>/^https:\/\//i.test(text(v))?text(v):null;
const canonical=v=>isCanonicalProductId(v)?text(v).toLowerCase():null;

export const MARKET_OBSERVATION_POLICY=Object.freeze({
  identity:'SOURCE_PLATFORM_EXTERNAL_ID_IDENTIFIES_THE_OBSERVATION; CANONICAL_UUID_REQUIRED_FOR_DECISION_HANDOFF; TITLE_NEVER_AUTO_MERGES',
  missing:'MISSING_NUMERIC_VALUES_REMAIN_NULL',
  sales:'PUBLIC_RANK_REVIEW_PRICE_RATING_NEVER_EQUAL_VERIFIED_SALES',
  history:'APPEND_ONLY_IDENTITY_PLUS_TIMESTAMP',
  purchase:'NO_PURCHASE_AUTHORITY'
});

export function normalizeMarketObservation(input={}){
  const platform=text(input.platform).toUpperCase(),externalId=text(input.externalId),observedAt=iso(input.observedAt),canonicalProductId=canonical(input.canonicalProductId);
  const errors=[];
  if(!platform)errors.push('PLATFORM_REQUIRED');
  if(!externalId)errors.push('EXTERNAL_ID_REQUIRED');
  if(!observedAt)errors.push('OBSERVED_AT_REQUIRED');
  const rank=num(input.sourceRank??input.rank),reviewCount=num(input.reviewCount),rating=num(input.rating),price=num(input.price);
  if(rank!==null&&(!Number.isInteger(rank)||rank<1))errors.push('SOURCE_RANK_INVALID');
  if(reviewCount!==null&&(reviewCount<0||!Number.isInteger(reviewCount)))errors.push('REVIEW_COUNT_INVALID');
  if(rating!==null&&(rating<0||rating>5))errors.push('RATING_INVALID');
  if(price!==null&&price<0)errors.push('PRICE_INVALID');
  const requestedSalesClass=text(input.salesEvidenceClass).toUpperCase();
  if(requestedSalesClass&&requestedSalesClass!=='NOT_VERIFIED_SALES')errors.push('VERIFIED_SALES_CANNOT_BE_INFERRED_FROM_MARKET_OBSERVATION');
  if(input.purchaseAuthorized===true||input.automaticPurchaseAllowed===true)errors.push('PURCHASE_AUTHORITY_FORBIDDEN');
  const observation={
    schemaVersion:'MPR_MARKET_OBSERVATION_V1',canonicalProductId,identityStatus:canonicalProductId?'CANONICAL':'UNBOUND_SOURCE_OBSERVATION',decisionEligible:Boolean(canonicalProductId),
    platform,externalId,observedAt,sourceKey:text(input.sourceKey).toUpperCase()||null,surface:text(input.surface).toUpperCase()||null,
    title:text(input.title||input.observedTitle)||null,brand:text(input.brand)||null,seller:text(input.seller)||null,categoryLabel:text(input.categoryLabel)||null,
    sourceUrl:https(input.sourceUrl||input.url),price,currency:text(input.currency).toUpperCase()||null,rating,reviewCount,sourceRank:rank,
    evidenceClass:normalizeEvidenceClass(input.evidenceClass||'DIRECT_OBSERVED'),salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null,
    appendOnly:true,purchaseAuthorized:false,automaticPurchaseAllowed:false
  };
  return{ok:errors.length===0,errors,observation};
}

export function marketObservationIdentity(input={}){
  const n=normalizeMarketObservation(input);if(!n.ok)return null;
  const x=n.observation;return`${x.platform}:${x.externalId}:${x.observedAt}`;
}

export function observationDecisionHandoff(input={}){
  const n=normalizeMarketObservation(input);
  if(!n.ok)return{ok:false,errors:n.errors,observation:n.observation};
  if(!n.observation.decisionEligible)return{ok:false,errors:['CANONICAL_PRODUCT_ID_REQUIRED_FOR_DECISION_HANDOFF'],observation:n.observation};
  return{ok:true,errors:[],observation:n.observation};
}

export function fromPublicSnapshot(input={}){
  return normalizeMarketObservation({
    canonicalProductId:input.canonicalProductId,platform:input.platform,externalId:input.externalId||String(input.identity||'').split(':').at(-1),observedAt:input.observedAt,
    sourceKey:input.sourceKey,surface:input.surface,title:input.title,brand:input.brand,seller:input.seller,categoryLabel:input.categoryLabel,sourceUrl:input.sourceUrl||input.url,
    price:input.price,currency:input.currency,rating:input.rating,reviewCount:input.reviewCount,sourceRank:input.sourceRank,evidenceClass:input.evidenceClass==='PUBLIC_MARKET_SNAPSHOT'?'DIRECT_OBSERVED':input.evidenceClass
  });
}
