const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const platformKey=v=>upper(v).replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
const cleanExternalId=v=>text(v).replace(/\s+/g,'');

export function normalizeTitleFingerprint(title=''){
  return text(title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

export function buildMarketplaceAlias({platform,externalId,market=null,title=null,sourceUrl=null}={}){
  const p=platformKey(platform),id=cleanExternalId(externalId);
  if(!p||!id) return {valid:false,reason:'PLATFORM_AND_EXTERNAL_ID_REQUIRED',platform:p||null,externalId:id||null};
  return {
    valid:true,
    aliasKey:`${p}:${id}`,
    platform:p,
    externalId:id,
    market:text(market).toUpperCase()||null,
    observedTitle:text(title)||null,
    titleFingerprint:normalizeTitleFingerprint(title)||null,
    sourceUrl:/^https:\/\//i.test(text(sourceUrl))?text(sourceUrl):null
  };
}

export function identityMatch(a={},b={}){
  const aa=buildMarketplaceAlias(a),bb=buildMarketplaceAlias(b);
  if(!aa.valid||!bb.valid)return {sameAlias:false,autoMergeAllowed:false,manualReviewHint:false,reason:'INVALID_ALIAS'};
  if(aa.aliasKey===bb.aliasKey)return {sameAlias:true,autoMergeAllowed:true,manualReviewHint:false,reason:'EXACT_PLATFORM_EXTERNAL_ID'};
  const titleSimilar=!!aa.titleFingerprint&&aa.titleFingerprint===bb.titleFingerprint;
  return {
    sameAlias:false,
    autoMergeAllowed:false,
    manualReviewHint:titleSimilar,
    reason:titleSimilar?'CROSS_ALIAS_TITLE_MATCH_REVIEW_ONLY':'DISTINCT_ALIAS'
  };
}

export function canonicalIdentitySeed(aliasInput={}){
  const alias=buildMarketplaceAlias(aliasInput);
  if(!alias.valid)return {valid:false,canonicalKey:null,alias};
  // Stable source identity is preferred over titles. This is a staging key only;
  // the database UUID is the canonical product identity once persisted.
  return {valid:true,canonicalKey:`source:${alias.aliasKey}`,alias};
}

export function bindEvidenceToCanonicalProduct(evidence={},canonicalProductId){
  const id=text(canonicalProductId);
  if(!id)throw new Error('canonicalProductId required');
  return {...evidence,canonicalProductId:id};
}

export function sameCanonicalProduct(...rows){
  const ids=rows.filter(Boolean).map(row=>text(row?.canonicalProductId)).filter(Boolean);
  return ids.length===rows.filter(Boolean).length&&new Set(ids).size===1;
}

export const CANONICAL_IDENTITY_POLICY=Object.freeze({
  databaseIdentity:'UUID',
  exactAliasUniqueness:'PLATFORM_EXTERNAL_ID',
  titleMatch:'MANUAL_REVIEW_HINT_ONLY',
  crossPlatformAutoMerge:false,
  missingIdentity:'FAIL_CLOSED'
});
