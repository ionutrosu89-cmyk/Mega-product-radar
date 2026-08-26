export const EVIDENCE_CLASSES=Object.freeze(['VERIFIED','DIRECT_OBSERVED','PROVIDER_VERIFIED','MANUALLY_VERIFIED','DERIVED','ESTIMATED','HEURISTIC','UNKNOWN']);
export const OPPORTUNITY_STAGES=Object.freeze(['DISCOVERED','PROMISING','VALIDATE','FINALIST','TEST_READY','TEST_RUNNING','TEST_VALIDATED','BUY_READY','BLOCKED','REVIEW']);

const text=v=>String(v??'').trim();
const iso=v=>{const t=Date.parse(String(v??''));return Number.isFinite(t)?new Date(t).toISOString():null;};
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCanonicalProductId(value){return uuidRe.test(text(value));}
export function requireCanonicalProductId(value){const id=text(value);if(!isCanonicalProductId(id)){const e=new Error('CANONICAL_PRODUCT_ID_REQUIRED');e.code='CANONICAL_PRODUCT_ID_REQUIRED';throw e;}return id.toLowerCase();}

export function normalizeEvidenceClass(value){const v=text(value).toUpperCase();return EVIDENCE_CLASSES.includes(v)?v:'UNKNOWN';}

export function createCanonicalProduct({canonicalProductId,title='',category=null,status='ACTIVE'}={}){
  return Object.freeze({schemaVersion:'MPR_CANONICAL_PRODUCT_V1',canonicalProductId:requireCanonicalProductId(canonicalProductId),title:text(title)||null,category:text(category)||null,status:text(status).toUpperCase()||'ACTIVE'});
}

export function createProductAlias({canonicalProductId,platform,externalId,observedTitle=null,sourceUrl=null}={}){
  const p=text(platform).toUpperCase(),external=text(externalId);
  if(!p||!external){const e=new Error('PLATFORM_AND_EXTERNAL_ID_REQUIRED');e.code='PLATFORM_AND_EXTERNAL_ID_REQUIRED';throw e;}
  return Object.freeze({schemaVersion:'MPR_PRODUCT_ALIAS_V1',canonicalProductId:requireCanonicalProductId(canonicalProductId),platform:p,externalId:external,observedTitle:text(observedTitle)||null,sourceUrl:text(sourceUrl)||null,identityPolicy:'EXACT_PLATFORM_EXTERNAL_ID_ONLY; TITLE_IS_DISPLAY_OR_MANUAL_REVIEW_HINT'});
}

export function createEvidence({canonicalProductId,value=null,observedAt,source,sourceUrl=null,evidenceClass='UNKNOWN',confidence=null,freshness=null,metric=null}={}){
  const id=requireCanonicalProductId(canonicalProductId),at=iso(observedAt),src=text(source),klass=normalizeEvidenceClass(evidenceClass);
  if(!at||!src){const e=new Error('EVIDENCE_PROVENANCE_REQUIRED');e.code='EVIDENCE_PROVENANCE_REQUIRED';throw e;}
  const confidenceNumber=confidence===null||confidence===undefined||confidence===''?null:Number(confidence);
  if(confidenceNumber!==null&&(!Number.isFinite(confidenceNumber)||confidenceNumber<0||confidenceNumber>100)){const e=new Error('EVIDENCE_CONFIDENCE_OUT_OF_RANGE');e.code='EVIDENCE_CONFIDENCE_OUT_OF_RANGE';throw e;}
  return Object.freeze({schemaVersion:'MPR_EVIDENCE_V1',canonicalProductId:id,metric:text(metric)||null,value:value??null,observedAt:at,source:src,sourceUrl:text(sourceUrl)||null,evidenceClass:klass,confidence:confidenceNumber,freshness:text(freshness)||null});
}

export function assertSameCanonicalProduct(candidateId,...records){
  const id=requireCanonicalProductId(candidateId);
  for(const record of records.flat().filter(Boolean)){
    const recordId=text(record.canonicalProductId||record.canonical_product_id);
    if(!recordId||recordId.toLowerCase()!==id){const e=new Error('CROSS_PRODUCT_EVIDENCE_REJECTED');e.code='CROSS_PRODUCT_EVIDENCE_REJECTED';e.expectedCanonicalProductId=id;e.actualCanonicalProductId=recordId||null;throw e;}
  }
  return true;
}

const evidenceRank=Object.freeze({UNKNOWN:0,HEURISTIC:1,ESTIMATED:2,DERIVED:3,DIRECT_OBSERVED:4,PROVIDER_VERIFIED:5,MANUALLY_VERIFIED:6,VERIFIED:7});
export function canPromoteEvidenceClass(from,to){const a=normalizeEvidenceClass(from),b=normalizeEvidenceClass(to);return a===b||evidenceRank[b]<=evidenceRank[a];}
export function assertNoSilentEvidenceUpgrade(from,to,{explicitReview=false}={}){
  const a=normalizeEvidenceClass(from),b=normalizeEvidenceClass(to);
  if(evidenceRank[b]>evidenceRank[a]&&!explicitReview){const e=new Error('SILENT_EVIDENCE_UPGRADE_REJECTED');e.code='SILENT_EVIDENCE_UPGRADE_REJECTED';throw e;}
  return true;
}

export function createOpportunityDecision({canonicalProductId,stage='DISCOVERED',reasonCodes=[],evidence=[],purchaseAuthorized=false,automaticPurchaseAllowed=false}={}){
  const id=requireCanonicalProductId(canonicalProductId),s=text(stage).toUpperCase();
  if(!OPPORTUNITY_STAGES.includes(s)){const e=new Error('INVALID_OPPORTUNITY_STAGE');e.code='INVALID_OPPORTUNITY_STAGE';throw e;}
  assertSameCanonicalProduct(id,evidence);
  if(purchaseAuthorized===true||automaticPurchaseAllowed===true){const e=new Error('PURCHASE_AUTHORITY_FORBIDDEN_IN_DOMAIN_DECISION');e.code='PURCHASE_AUTHORITY_FORBIDDEN_IN_DOMAIN_DECISION';throw e;}
  return Object.freeze({schemaVersion:'MPR_OPPORTUNITY_DECISION_V1',canonicalProductId:id,stage:s,reasonCodes:Object.freeze((reasonCodes||[]).map(x=>text(x)).filter(Boolean)),evidence:Object.freeze([...evidence]),purchaseAuthorized:false,automaticPurchaseAllowed:false});
}

export const DOMAIN_POLICY=Object.freeze({
  identity:'CANONICAL_UUID_IS_IDENTITY; PRODUCT_NAME_IS_LABEL_ONLY; CROSS_PLATFORM_TITLE_MATCH_NEVER_AUTO_MERGES',
  evidence:'MISSING_STAYS_MISSING; PROVENANCE_REQUIRED; NO_SILENT_EVIDENCE_UPGRADE; SAME_CANONICAL_PRODUCT_ONLY',
  decision:'ONE_CANONICAL_PRODUCT_PER_DECISION; NO_AUTOMATIC_PURCHASE_AUTHORITY'
});
