import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};
const iso=value=>parseTime(value)===null?null:new Date(parseTime(value)).toISOString();
const clone=value=>JSON.parse(JSON.stringify(value??null));

export function createObservationLease(input={},options={}){
  const claimedAt=iso(options.claimedAt||new Date().toISOString());
  const leaseDurationMs=Math.max(1000,Number(options.leaseDurationMs||5*60*1000));
  const inboxFingerprint=clean(input.inboxFingerprint)||null;
  const sourceFingerprint=clean(input.sourceFingerprint)||null;
  const workerId=clean(options.workerId)||null;
  const attempt=Math.max(1,Number(options.attempt||1));
  const reasons=[];
  if(!claimedAt)reasons.push('CLAIMED_AT_REQUIRED');
  if(!inboxFingerprint)reasons.push('INBOX_FINGERPRINT_REQUIRED');
  if(!sourceFingerprint)reasons.push('SOURCE_FINGERPRINT_REQUIRED');
  if(!workerId)reasons.push('WORKER_ID_REQUIRED');
  const expiresAt=claimedAt?new Date(Date.parse(claimedAt)+leaseDurationMs).toISOString():null;
  const payload={
    schema:'MPR_OBSERVATION_INBOX_LEASE_V1',
    inboxFingerprint,
    sourceFingerprint,
    workerId,
    attempt,
    claimedAt,
    expiresAt,
    leaseDurationMs,
    valid:reasons.length===0,
    reasons,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function validateObservationLease(lease={},options={}){
  const nowMs=parseTime(options.now||new Date().toISOString());
  const claimedMs=parseTime(lease.claimedAt);
  const expiresMs=parseTime(lease.expiresAt);
  const expected=deterministicFingerprint({
    schema:lease.schema,
    inboxFingerprint:lease.inboxFingerprint??null,
    sourceFingerprint:lease.sourceFingerprint??null,
    workerId:lease.workerId??null,
    attempt:Number(lease.attempt||1),
    claimedAt:lease.claimedAt??null,
    expiresAt:lease.expiresAt??null,
    leaseDurationMs:Number(lease.leaseDurationMs||0),
    valid:lease.valid===true,
    reasons:Array.isArray(lease.reasons)?lease.reasons:[],
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  });
  const reasons=[];
  if(lease.schema!=='MPR_OBSERVATION_INBOX_LEASE_V1')reasons.push('LEASE_SCHEMA_INVALID');
  if(clean(lease.fingerprint)!==expected)reasons.push('LEASE_FINGERPRINT_MISMATCH');
  if(!clean(lease.workerId))reasons.push('WORKER_ID_REQUIRED');
  if(!clean(lease.inboxFingerprint))reasons.push('INBOX_FINGERPRINT_REQUIRED');
  if(nowMs===null)reasons.push('NOW_INVALID');
  if(claimedMs===null)reasons.push('CLAIMED_AT_REQUIRED');
  if(expiresMs===null)reasons.push('EXPIRES_AT_REQUIRED');
  if(Number(lease.providerDataSpendEur||0)!==0||Number(lease.paidDataCallsTriggered||0)!==0)reasons.push('PAID_DATA_ACTIVITY_BLOCKED');
  if(lease.purchaseAuthorized!==false)reasons.push('PURCHASE_AUTHORIZATION_FORBIDDEN');
  const expired=nowMs!==null&&expiresMs!==null&&nowMs>=expiresMs;
  if(expired)reasons.push('LEASE_EXPIRED');
  return{
    schema:'MPR_OBSERVATION_INBOX_LEASE_VALIDATION_V1',
    valid:reasons.length===0,
    active:reasons.length===0&&!expired,
    expired,
    decision:reasons.length===0?'ACTIVE':'HOLD',
    reasons
  };
}

export async function claimObservationInboxEntry(store,input={},options={}){
  if(!store||typeof store.get!=='function'||typeof store.put!=='function')throw new Error('OBSERVATION_LEASE_STORE_REQUIRED');
  const inboxFingerprint=clean(input.inboxFingerprint);
  if(!inboxFingerprint)throw new Error('INBOX_FINGERPRINT_REQUIRED');
  const key=clean(options.key)||`observation-leases/${inboxFingerprint}`;
  const existing=await store.get(key);
  const now=options.now||options.claimedAt||new Date().toISOString();
  if(existing){
    const record=existing?.record??existing;
    const validation=validateObservationLease(record,{now});
    if(validation.active){
      const sameWorker=clean(record.workerId)===clean(options.workerId);
      return{
        schema:'MPR_OBSERVATION_INBOX_CLAIM_V1',
        decision:sameWorker?'ALREADY_CLAIMED':'LEASE_CONFLICT',
        claimed:false,
        idempotent:sameWorker,
        key,
        lease:clone(record),
        validation
      };
    }
  }
  const previous=existing?.record??existing??null;
  const attempt=Math.max(1,Number(previous?.attempt||0)+1);
  const lease=createObservationLease(input,{...options,claimedAt:now,attempt});
  const validation=validateObservationLease(lease,{now});
  if(!validation.active)return{schema:'MPR_OBSERVATION_INBOX_CLAIM_V1',decision:'HOLD',claimed:false,key,lease,validation};
  await store.put(key,{schema:'MPR_OBSERVATION_INBOX_LEASE_STORED_V1',record:lease});
  return{
    schema:'MPR_OBSERVATION_INBOX_CLAIM_V1',
    decision:previous?'RECLAIMED_EXPIRED_LEASE':'CLAIMED',
    claimed:true,
    idempotent:true,
    key,
    lease,
    validation
  };
}

export function createObservationRecoveryLedgerEntry(input={},options={}){
  const observedAt=iso(options.observedAt||new Date().toISOString());
  const payload={
    schema:'MPR_OBSERVATION_RECOVERY_LEDGER_ENTRY_V1',
    inboxFingerprint:clean(input.inboxFingerprint)||null,
    sourceFingerprint:clean(input.sourceFingerprint)||null,
    leaseFingerprint:clean(input.leaseFingerprint)||null,
    workerId:clean(input.workerId)||null,
    attempt:Math.max(1,Number(input.attempt||1)),
    event:clean(input.event).toUpperCase()||'UNKNOWN',
    observedAt,
    detail:clone(input.detail),
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}
