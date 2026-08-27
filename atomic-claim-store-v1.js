import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};
const iso=value=>parseTime(value)===null?null:new Date(parseTime(value)).toISOString();
const clone=value=>JSON.parse(JSON.stringify(value??null));

export function createMemoryAtomicClaimStore(){
  const records=new Map();
  return{
    scope:'LOCAL_MEMORY_CAS',
    productionAtomicityVerified:false,
    async read(key){return clone(records.get(key)||null);},
    async compareAndSet(key,expectedVersion,nextRecord){
      const current=records.get(key)||null;
      const currentVersion=Number(current?.version||0);
      if(currentVersion!==Number(expectedVersion||0))return{ok:false,current:clone(current),currentVersion};
      const stored={...clone(nextRecord),version:currentVersion+1};
      records.set(key,stored);
      return{ok:true,current:clone(stored),currentVersion:stored.version};
    }
  };
}

export function createFencedClaim(input={},options={}){
  const claimedAt=iso(options.claimedAt||new Date().toISOString());
  const leaseDurationMs=Math.max(1000,Number(options.leaseDurationMs||5*60*1000));
  const fencingToken=Math.max(1,Number(options.fencingToken||1));
  const payload={
    schema:'MPR_FENCED_OBSERVATION_CLAIM_V1',
    inboxFingerprint:clean(input.inboxFingerprint)||null,
    sourceFingerprint:clean(input.sourceFingerprint)||null,
    workerId:clean(options.workerId)||null,
    fencingToken,
    claimedAt,
    expiresAt:claimedAt?new Date(Date.parse(claimedAt)+leaseDurationMs).toISOString():null,
    leaseDurationMs,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function validateFencedClaim(claim={},options={}){
  const nowMs=parseTime(options.now||new Date().toISOString());
  const expiresMs=parseTime(claim.expiresAt);
  const reasons=[];
  if(claim.schema!=='MPR_FENCED_OBSERVATION_CLAIM_V1')reasons.push('CLAIM_SCHEMA_INVALID');
  if(!clean(claim.inboxFingerprint))reasons.push('INBOX_FINGERPRINT_REQUIRED');
  if(!clean(claim.workerId))reasons.push('WORKER_ID_REQUIRED');
  if(!(Number(claim.fencingToken)>0))reasons.push('FENCING_TOKEN_REQUIRED');
  if(nowMs===null)reasons.push('NOW_INVALID');
  if(expiresMs===null)reasons.push('EXPIRES_AT_REQUIRED');
  const expired=nowMs!==null&&expiresMs!==null&&nowMs>=expiresMs;
  if(expired)reasons.push('CLAIM_EXPIRED');
  if(Number(claim.providerDataSpendEur||0)!==0||Number(claim.paidDataCallsTriggered||0)!==0)reasons.push('PAID_DATA_ACTIVITY_BLOCKED');
  if(claim.purchaseAuthorized!==false)reasons.push('PURCHASE_AUTHORIZATION_FORBIDDEN');
  return{
    schema:'MPR_FENCED_OBSERVATION_CLAIM_VALIDATION_V1',
    valid:reasons.length===0,
    active:reasons.length===0&&!expired,
    expired,
    decision:reasons.length===0?'ACTIVE':'HOLD',
    reasons
  };
}

export async function acquireAtomicObservationClaim(store,input={},options={}){
  if(!store||typeof store.read!=='function'||typeof store.compareAndSet!=='function')throw new Error('ATOMIC_CLAIM_STORE_REQUIRED');
  const inboxFingerprint=clean(input.inboxFingerprint);
  if(!inboxFingerprint)throw new Error('INBOX_FINGERPRINT_REQUIRED');
  const key=clean(options.key)||`atomic-observation-claims/${inboxFingerprint}`;
  const now=options.now||options.claimedAt||new Date().toISOString();
  for(let attempt=0;attempt<Math.max(1,Number(options.maxCasAttempts||3));attempt++){
    const current=await store.read(key);
    const currentVersion=Number(current?.version||0);
    const currentClaim=current?.claim||null;
    const currentValidation=currentClaim?validateFencedClaim(currentClaim,{now}):null;
    if(currentClaim&&currentValidation?.active){
      const sameWorker=clean(currentClaim.workerId)===clean(options.workerId);
      return{
        schema:'MPR_ATOMIC_OBSERVATION_CLAIM_RESULT_V1',
        decision:sameWorker?'ALREADY_CLAIMED':'ACTIVE_CLAIM_CONFLICT',
        acquired:false,
        idempotent:sameWorker,
        key,
        claim:clone(currentClaim),
        storeScope:store.scope||'UNKNOWN',
        productionAtomicityVerified:store.productionAtomicityVerified===true
      };
    }
    const fencingToken=Math.max(1,Number(currentClaim?.fencingToken||0)+1);
    const claim=createFencedClaim(input,{...options,claimedAt:now,fencingToken});
    const nextRecord={schema:'MPR_ATOMIC_OBSERVATION_CLAIM_RECORD_V1',claim};
    const cas=await store.compareAndSet(key,currentVersion,nextRecord);
    if(cas.ok){
      return{
        schema:'MPR_ATOMIC_OBSERVATION_CLAIM_RESULT_V1',
        decision:currentClaim?'RECLAIMED_WITH_FENCE':'ACQUIRED',
        acquired:true,
        idempotent:true,
        key,
        claim,
        recordVersion:Number(cas.currentVersion||currentVersion+1),
        storeScope:store.scope||'UNKNOWN',
        productionAtomicityVerified:store.productionAtomicityVerified===true,
        exactlyOnceGuaranteed:false
      };
    }
  }
  return{
    schema:'MPR_ATOMIC_OBSERVATION_CLAIM_RESULT_V1',
    decision:'CAS_RETRY_EXHAUSTED',
    acquired:false,
    key,
    storeScope:store.scope||'UNKNOWN',
    productionAtomicityVerified:store.productionAtomicityVerified===true,
    exactlyOnceGuaranteed:false
  };
}

export function validateFencingToken(currentClaim={},candidateToken){
  const current=Number(currentClaim.fencingToken||0);
  const candidate=Number(candidateToken||0);
  const valid=candidate===current&&candidate>0;
  return{
    schema:'MPR_FENCING_TOKEN_VALIDATION_V1',
    valid,
    decision:valid?'FENCE_ACCEPT':'FENCE_REJECT',
    currentToken:current,
    candidateToken:candidate,
    reasons:valid?[]:['STALE_OR_INVALID_FENCING_TOKEN']
  };
}
