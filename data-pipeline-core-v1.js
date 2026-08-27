import crypto from 'node:crypto';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const upper=value=>clean(value).toUpperCase();
const iso=value=>{const t=Date.parse(String(value??''));return Number.isFinite(t)?new Date(t).toISOString():null;};

export function canonicalProductKey({platform,marketplace,externalId}={}){
  const p=upper(platform);
  const m=upper(marketplace||platform);
  const e=upper(externalId);
  if(!p||!m||!e)return null;
  return `${p}:${m}:${e}`;
}

export function normalizeObservation(input={}){
  const platform=upper(input.platform);
  const marketplace=upper(input.marketplace||input.platform);
  const externalId=upper(input.externalId||input.asin);
  const canonicalKey=canonicalProductKey({platform,marketplace,externalId});
  return{
    schema:'MPR_NORMALIZED_OBSERVATION_V1',
    canonicalKey,
    platform:platform||null,
    marketplace:marketplace||null,
    externalId:externalId||null,
    sourceKey:upper(input.sourceKey)||null,
    surface:upper(input.surface)||null,
    title:clean(input.title)||null,
    brand:clean(input.brand)||null,
    categoryLabel:clean(input.categoryLabel)||null,
    url:clean(input.url)||null,
    observedAt:iso(input.observedAt),
    evidenceClass:upper(input.evidenceClass)||'OBSERVATION',
    salesEvidenceClass:upper(input.salesEvidenceClass)||'NOT_VERIFIED_SALES',
    purchaseAuthorized:input.purchaseAuthorized===true,
    payload:input
  };
}

export function validateNormalizedObservation(row={}){
  const errors=[];
  if(row.schema!=='MPR_NORMALIZED_OBSERVATION_V1')errors.push('SCHEMA_INVALID');
  if(!row.platform)errors.push('PLATFORM_MISSING');
  if(!row.marketplace)errors.push('MARKETPLACE_MISSING');
  if(!row.externalId)errors.push('EXTERNAL_ID_MISSING');
  if(!row.canonicalKey)errors.push('CANONICAL_KEY_MISSING');
  if(row.purchaseAuthorized===true)errors.push('PURCHASE_AUTHORIZATION_FORBIDDEN');
  if(row.salesEvidenceClass==='VERIFIED_SALES')errors.push('VERIFIED_SALES_REQUIRES_TRUTH_PIPELINE');
  return{ok:errors.length===0,errors};
}

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}

export function deterministicFingerprint(value){
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function buildCanonicalBatch(observations=[]){
  const accepted=[];const rejected=[];const byKey=new Map();
  for(let index=0;index<observations.length;index++){
    const normalized=normalizeObservation(observations[index]);
    const validation=validateNormalizedObservation(normalized);
    if(!validation.ok){rejected.push({index,errors:validation.errors,observation:normalized});continue;}
    const previous=byKey.get(normalized.canonicalKey);
    if(previous){
      rejected.push({index,errors:['LOGICAL_DUPLICATE'],canonicalKey:normalized.canonicalKey,observation:normalized});
      continue;
    }
    byKey.set(normalized.canonicalKey,normalized);
    accepted.push(normalized);
  }
  const manifest={
    schema:'MPR_CANONICAL_BATCH_V1',
    inputCount:observations.length,
    canonicalCount:accepted.length,
    rejectedCount:rejected.length,
    logicalDuplicateCount:rejected.filter(x=>x.errors.includes('LOGICAL_DUPLICATE')).length,
    canonicalKeys:accepted.map(x=>x.canonicalKey).sort()
  };
  return{manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},accepted,rejected};
}

export function evaluateScaleGate(batch={},options={}){
  const manifest=batch.manifest||{};
  const requiredCanonicalCount=Math.max(1,Number(options.requiredCanonicalCount||1000000));
  const provenanceComplete=options.provenanceComplete===true;
  const restoreVerified=options.restoreVerified===true;
  const replayDeterministic=options.replayDeterministic===true;
  const queuesStable=options.queuesStable===true;
  const p95Ms=Number(options.p95Ms);
  const p95LimitMs=Math.max(1,Number(options.p95LimitMs||1000));
  const checks={
    canonicalVolume:Number(manifest.canonicalCount||0)>=requiredCanonicalCount,
    zeroLogicalDuplicates:Number(manifest.logicalDuplicateCount||0)===0,
    provenanceComplete,
    restoreVerified,
    replayDeterministic,
    queuesStable,
    p95Acceptable:Number.isFinite(p95Ms)&&p95Ms<=p95LimitMs
  };
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return{
    decision:failed.length?'HOLD_SCALE':'SCALE_READY',
    scaleAuthorized:failed.length===0,
    failed,
    checks,
    requiredCanonicalCount,
    canonicalCount:Number(manifest.canonicalCount||0)
  };
}
