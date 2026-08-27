import crypto from 'node:crypto';
import {buildCatalogBatch,adaptOpenFactsRecord,adaptEprelRecord} from './catalog-source-adapters-v1.js';
import {resolveCandidatePair} from './canonical-identity-v2.js';

const clean=value=>String(value??'').trim();
const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
};
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex');
const iso=value=>{
  const d=new Date(value||0);
  return Number.isNaN(d.getTime())?null:d.toISOString();
};

export const BULK_INGESTION_SCHEMA='MPR_BULK_CATALOG_INGESTION_V1';

export function resolveAdapter(sourceKey){
  const key=clean(sourceKey).toUpperCase();
  if(['OPEN_FOOD_FACTS','OPEN_BEAUTY_FACTS','OPEN_PET_FOOD_FACTS','OPEN_PRODUCTS_FACTS'].includes(key))return adaptOpenFactsRecord;
  if(key==='EPREL_PUBLIC')return adaptEprelRecord;
  return null;
}

export function createSourceManifest({sourceKey,records=[],retrievedAt,artifactRef=null,format='JSON'}={}){
  const key=clean(sourceKey).toUpperCase();
  const observed=iso(retrievedAt);
  if(!key)throw new TypeError('sourceKey required');
  if(!observed)throw new TypeError('valid retrievedAt required');
  const payload={sourceKey:key,retrievedAt:observed,artifactRef:clean(artifactRef)||null,format:clean(format).toUpperCase()||'JSON',recordCount:records.length,recordsSha256:sha(records)};
  return{schema:'MPR_SOURCE_MANIFEST_V1',...payload,manifestSha256:sha(payload)};
}

export function buildProductClaims(candidate={}){
  const sourceKey=clean(candidate.sourceKey).toUpperCase();
  const sourceRecordId=clean(candidate.sourceRecordId)||null;
  const observedAt=iso(candidate.observedAt);
  const fields=['title','brand','category','gtin','mpn','model','eprelId'];
  const claims=[];
  for(const field of fields){
    const value=candidate[field];
    if(value===null||value===undefined||clean(value)==='')continue;
    const claim={sourceKey,sourceRecordId,field,value,observedAt,rightsDecision:candidate.rightsDecision,evidenceClass:candidate.evidenceClass,confidence:['gtin','eprelId','mpn'].includes(field)?1:0.8};
    claims.push({...claim,claimSha256:sha(claim)});
  }
  return claims;
}

export function calibrateIdentityDecisions(candidates=[],{sampleLimit=500}={}){
  const sample=candidates.slice(0,Math.max(0,Number(sampleLimit)||0));
  const decisions=[];
  for(let i=0;i<sample.length;i++){
    for(let j=i+1;j<sample.length;j++){
      const a=sample[i],b=sample[j];
      if(a.brand&&b.brand&&String(a.brand).toUpperCase()!==String(b.brand).toUpperCase())continue;
      const resolution=resolveCandidatePair(a,b);
      if(resolution.decision!=='KEEP_SEPARATE'||resolution.confidence>=0.75){
        decisions.push({aFingerprint:a.fingerprint,bFingerprint:b.fingerprint,...resolution});
      }
    }
  }
  return{
    schema:'MPR_IDENTITY_CALIBRATION_V1',
    sampledProducts:sample.length,
    pairDecisions:decisions.length,
    autoMerge:decisions.filter(x=>x.decision==='AUTO_MERGE').length,
    review:decisions.filter(x=>x.decision==='REVIEW').length,
    keepSeparate:decisions.filter(x=>x.decision==='KEEP_SEPARATE').length,
    decisions
  };
}

export function runBulkCatalogIngestion(input={},options={}){
  const records=Array.isArray(input.records)?input.records:[];
  const sourceKey=clean(input.sourceKey).toUpperCase();
  const retrievedAt=input.retrievedAt||options.retrievedAt;
  const adapter=options.adapter||resolveAdapter(sourceKey);
  if(!adapter)throw new TypeError(`unsupported sourceKey ${sourceKey||'(empty)'}`);
  const manifest=createSourceManifest({sourceKey,records,retrievedAt,artifactRef:input.artifactRef,format:input.format});
  const batch=buildCatalogBatch(records,adapter,{sourceKey,observedAt:manifest.retrievedAt});
  const accepted=[];
  const held=[...batch.held];
  const existing=new Set((options.existingIdentityKeys||[]).map(clean).filter(Boolean));
  const strongKey=c=>{
    const k=(c.identityKeys||[]).find(x=>['GTIN','EPREL','ASIN','ICECAT'].includes(x.namespace));
    return k?`${k.namespace}:${k.valueNorm}`:null;
  };
  for(const c of batch.accepted){
    const k=strongKey(c);
    if(k&&existing.has(k)){held.push({...c,holdReason:'EXISTING_LOGICAL_DUPLICATE'});continue;}
    if(k)existing.add(k);
    accepted.push(c);
  }
  const claims=accepted.flatMap(buildProductClaims);
  const acceptedFingerprint=sha(accepted.map(x=>x.fingerprint).sort());
  const checkpoint={schema:'MPR_BULK_INGESTION_CHECKPOINT_V1',sourceKey,cursor:records.length,acceptedCount:accepted.length,acceptedFingerprint,manifestSha256:manifest.manifestSha256};
  checkpoint.checkpointSha256=sha(checkpoint);
  const calibration=calibrateIdentityDecisions(accepted,{sampleLimit:options.calibrationSampleLimit??250});
  const stats={
    input:records.length,
    accepted:accepted.length,
    held:held.length,
    logicalDuplicates:held.filter(x=>['LOGICAL_DUPLICATE','EXISTING_LOGICAL_DUPLICATE'].includes(x.holdReason)).length,
    strongIdentityProducts:accepted.filter(x=>['STRONG_GTIN','STRONG_SOURCE_REGISTRY'].includes(x.identityStrength)).length,
    claimCount:claims.length,
    silentDrops:Math.max(0,records.length-accepted.length-held.length)
  };
  return{
    schema:BULK_INGESTION_SCHEMA,
    manifest,accepted,held,claims,checkpoint,calibration,stats,
    policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,syntheticCountedAsReal:false},
    decision:stats.silentDrops===0?'INGESTION_ACCOUNTED':'HOLD_INGESTION_ACCOUNTING'
  };
}

export function evaluateTenKCatalogGate(input={}){
  const canonicalCount=Math.max(0,Number(input.canonicalCount)||0);
  const logicalDuplicateCount=Math.max(0,Number(input.logicalDuplicateCount)||0);
  const provenanceComplete=input.provenanceComplete===true;
  const replayDeterministic=input.replayDeterministic===true;
  const checkpointRestoreVerified=input.checkpointRestoreVerified===true;
  const silentDrops=Math.max(0,Number(input.silentDrops)||0);
  const syntheticCount=Math.max(0,Number(input.syntheticCount)||0);
  const providerDataSpendEur=Number(input.providerDataSpendEur||0);
  const paidDataCallsTriggered=Number(input.paidDataCallsTriggered||0);
  const purchaseAuthorized=input.purchaseAuthorized===true;
  const duplicateRate=canonicalCount?logicalDuplicateCount/(canonicalCount+logicalDuplicateCount):0;
  const reasons=[];
  if(canonicalCount<10000)reasons.push('CANONICAL_COUNT_BELOW_10K');
  if(syntheticCount>0)reasons.push('SYNTHETIC_PRODUCTS_EXCLUDED');
  if(!provenanceComplete)reasons.push('PROVENANCE_INCOMPLETE');
  if(duplicateRate>=0.005)reasons.push('LOGICAL_DUPLICATE_RATE_TOO_HIGH');
  if(!replayDeterministic)reasons.push('REPLAY_NOT_DETERMINISTIC');
  if(!checkpointRestoreVerified)reasons.push('CHECKPOINT_RESTORE_NOT_VERIFIED');
  if(silentDrops!==0)reasons.push('SILENT_DROPS_DETECTED');
  if(providerDataSpendEur!==0)reasons.push('PROVIDER_SPEND_NONZERO');
  if(paidDataCallsTriggered!==0)reasons.push('PAID_DATA_CALLS_NONZERO');
  if(purchaseAuthorized)reasons.push('PURCHASE_AUTHORIZED');
  return{
    schema:'MPR_10K_CATALOG_GATE_V1',
    decision:reasons.length?'HOLD_10K':'TEN_K_READY',
    reasons,
    metrics:{canonicalCount,logicalDuplicateCount,duplicateRate,provenanceComplete,replayDeterministic,checkpointRestoreVerified,silentDrops,syntheticCount},
    policy:{providerDataSpendEur,paidDataCallsTriggered,purchaseAuthorized,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0}
  };
}
