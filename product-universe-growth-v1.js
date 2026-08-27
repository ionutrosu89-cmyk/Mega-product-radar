import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {getSourceRights} from './source-rights-registry-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const num=value=>{const n=Number(String(value??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null;};

export const PRODUCT_UNIVERSE_TARGET=10000;
export const HF_SOURCE_KEY='HF_AJAY_SANKEY_AMAZON_PRODUCTS_MIT';

export function parseAmazonIdentity(url=''){
  const raw=clean(url);
  if(!raw)return null;
  let host='';
  try{host=new URL(raw).hostname.toLowerCase();}catch{return null;}
  const asin=raw.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase()||null;
  if(!asin)return null;
  const marketplace=host.endsWith('amazon.in')?'AMAZON_IN':host.endsWith('amazon.co.uk')?'AMAZON_UK':host.endsWith('amazon.de')?'AMAZON_DE':host.endsWith('amazon.com')?'AMAZON_US':'AMAZON_OTHER';
  return{marketplace,asin,canonicalKey:`AMAZON:${marketplace}:${asin}`};
}

export function normalizeUniverseCandidate(row={},options={}){
  const sourceKey=upper(options.sourceKey||HF_SOURCE_KEY);
  const rights=getSourceRights(sourceKey);
  const identity=parseAmazonIdentity(row.link||row.url||row.product_url);
  const title=clean(row.name||row.title||row.product_name);
  if(!rights.analysisAllowed)return{accepted:false,reason:'SOURCE_ANALYSIS_RIGHTS_REQUIRED',sourceKey};
  if(!identity)return{accepted:false,reason:'EXACT_AMAZON_IDENTITY_REQUIRED',sourceKey};
  if(!title)return{accepted:false,reason:'TITLE_REQUIRED',sourceKey};
  const candidate={
    sourceKey,
    platform:'AMAZON',
    marketplace:identity.marketplace,
    externalId:identity.asin,
    canonicalKey:identity.canonicalKey,
    url:clean(row.link||row.url||row.product_url),
    title,
    categoryLabel:clean(row.sub_category||row.category||row.main_category)||null,
    parentCategoryLabel:clean(row.main_category)||null,
    rating:num(row.ratings||row.rating),
    reviewCount:num(row.no_of_ratings||row.review_count||row.reviews),
    price:num(row.discount_price||row.actual_price||row.price),
    surface:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',
    evidenceClass:'OPEN_LICENSE_DATASET_PRODUCT',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    rankingEligible:false,
    commercialUseAllowed:false,
    purchaseAuthorized:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    sourceRights:{status:rights.status,analysisAllowed:rights.analysisAllowed,commercialUseAllowed:rights.commercialUseAllowed,basis:rights.basis,evidenceRef:rights.evidenceRef,reviewedAt:rights.reviewedAt}
  };
  return{accepted:true,candidate};
}

export function buildUniverseBatch(rows=[],options={}){
  const accepted=[];const rejected=[];const seen=new Set();let duplicateCount=0;
  for(const [index,row] of rows.entries()){
    const normalized=normalizeUniverseCandidate(row,options);
    if(!normalized.accepted){rejected.push({index,reason:normalized.reason});continue;}
    if(seen.has(normalized.candidate.canonicalKey)){duplicateCount++;rejected.push({index,reason:'LOGICAL_DUPLICATE',canonicalKey:normalized.candidate.canonicalKey});continue;}
    seen.add(normalized.candidate.canonicalKey);accepted.push(normalized.candidate);
  }
  const payload={schema:'MPR_PRODUCT_UNIVERSE_BATCH_V1',sourceKey:upper(options.sourceKey||HF_SOURCE_KEY),acceptedCount:accepted.length,rejectedCount:rejected.length,logicalDuplicateCount:duplicateCount,candidates:accepted,rejected,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',commercialUseAllowed:false};
  return{...payload,batchFingerprint:deterministicFingerprint(payload)};
}

export function evaluateUniverseGrowth(input={}){
  const currentCanonicalCount=Math.max(0,Number(input.currentCanonicalCount||0));
  const target=Math.max(1,Number(input.target||PRODUCT_UNIVERSE_TARGET));
  const candidateBatchCount=Math.max(0,Number(input.candidateBatchCount||0));
  const projectedCanonicalCount=currentCanonicalCount+candidateBatchCount;
  const remaining=Math.max(0,target-currentCanonicalCount);
  const projectedRemaining=Math.max(0,target-projectedCanonicalCount);
  const payload={schema:'MPR_PRODUCT_UNIVERSE_GROWTH_V1',currentCanonicalCount,target,candidateBatchCount,projectedCanonicalCount,remaining,projectedRemaining,stageDecision:currentCanonicalCount>=target?'10K_CANONICAL_REACHED':'HOLD_10K_CANONICAL',candidateImportCanOnlySupportAnalysis:true,commercialUseAllowed:false,rankingEligible:false,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'};
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}
