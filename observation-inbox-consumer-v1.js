import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {validateSchedulerAttestation} from './live-observation-inbox-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};

export function createObservationConsumptionReceipt(input={},options={}){
  const completedAt=clean(options.completedAt)||new Date().toISOString();
  const schedulerValidation=options.schedulerAttestation?validateSchedulerAttestation(options.schedulerAttestation):null;
  const productionPersistenceVerified=options.productionPersistenceVerified===true;
  const cycleDecision=upper(input.cycleDecision);
  const handoffFingerprint=clean(input.handoffFingerprint)||null;
  const inboxFingerprint=clean(input.inboxFingerprint)||null;
  const sourceFingerprint=clean(input.sourceFingerprint)||null;
  const reasons=[];
  if(parseTime(completedAt)===null)reasons.push('COMPLETED_AT_REQUIRED');
  if(!inboxFingerprint)reasons.push('INBOX_FINGERPRINT_REQUIRED');
  if(!sourceFingerprint)reasons.push('SOURCE_FINGERPRINT_REQUIRED');
  if(cycleDecision!=='COMPLETED')reasons.push('HISTORY_CYCLE_NOT_COMPLETED');
  if(!handoffFingerprint)reasons.push('HANDOFF_FINGERPRINT_REQUIRED');
  const analysisConsumed=reasons.length===0;
  const productionConsumed=analysisConsumed&&productionPersistenceVerified&&schedulerValidation?.ok===true;
  const payload={
    schema:'MPR_OBSERVATION_CONSUMPTION_RECEIPT_V1',
    inboxFingerprint,
    sourceFingerprint,
    cycleFingerprint:clean(input.cycleFingerprint)||null,
    cycleDecision:cycleDecision||null,
    handoffFingerprint,
    completedAt:parseTime(completedAt)===null?null:new Date(Date.parse(completedAt)).toISOString(),
    analysisConsumed,
    productionConsumed,
    productionPersistenceVerified,
    schedulerAttestation:schedulerValidation,
    reasons,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function validateObservationConsumptionReceipt(receipt={}){
  const expected=deterministicFingerprint({
    schema:receipt.schema,
    inboxFingerprint:receipt.inboxFingerprint??null,
    sourceFingerprint:receipt.sourceFingerprint??null,
    cycleFingerprint:receipt.cycleFingerprint??null,
    cycleDecision:receipt.cycleDecision??null,
    handoffFingerprint:receipt.handoffFingerprint??null,
    completedAt:receipt.completedAt??null,
    analysisConsumed:receipt.analysisConsumed===true,
    productionConsumed:receipt.productionConsumed===true,
    productionPersistenceVerified:receipt.productionPersistenceVerified===true,
    schedulerAttestation:receipt.schedulerAttestation??null,
    reasons:Array.isArray(receipt.reasons)?receipt.reasons:[],
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  });
  const reasons=[];
  if(receipt.schema!=='MPR_OBSERVATION_CONSUMPTION_RECEIPT_V1')reasons.push('RECEIPT_SCHEMA_INVALID');
  if(clean(receipt.fingerprint)!==expected)reasons.push('RECEIPT_FINGERPRINT_MISMATCH');
  if(Number(receipt.providerDataSpendEur||0)!==0||Number(receipt.paidDataCallsTriggered||0)!==0)reasons.push('PAID_DATA_ACTIVITY_BLOCKED');
  if(receipt.purchaseAuthorized!==false)reasons.push('PURCHASE_AUTHORIZATION_FORBIDDEN');
  if(Number(receipt.verifiedSalesRows||0)!==0||upper(receipt.salesEvidenceClass)!=='NOT_VERIFIED_SALES')reasons.push('TRUTH_CLASS_VIOLATION');
  if(receipt.productionConsumed===true){
    if(receipt.productionPersistenceVerified!==true)reasons.push('PRODUCTION_PERSISTENCE_REQUIRED');
    if(receipt.schedulerAttestation?.ok!==true)reasons.push('PRODUCTION_SCHEDULER_ATTESTATION_REQUIRED');
    if(receipt.analysisConsumed!==true)reasons.push('ANALYSIS_CONSUMPTION_REQUIRED');
  }
  return{
    schema:'MPR_OBSERVATION_CONSUMPTION_RECEIPT_VALIDATION_V1',
    valid:reasons.length===0,
    decision:reasons.length===0?'VALID':'HOLD',
    reasons
  };
}

export async function persistObservationConsumptionReceipt(store,receipt={},options={}){
  if(!store||typeof store.get!=='function'||typeof store.put!=='function')throw new Error('OBSERVATION_CONSUMPTION_STORE_REQUIRED');
  const validation=validateObservationConsumptionReceipt(receipt);
  if(!validation.valid)return{schema:'MPR_OBSERVATION_CONSUMPTION_PERSIST_V1',decision:'HOLD',persisted:false,validation};
  const key=clean(options.key)||`observation-consumption/${clean(receipt.inboxFingerprint)}`;
  const existing=await store.get(key);
  if(existing){
    const existingReceipt=existing?.record??existing;
    const same=clean(existingReceipt?.fingerprint)===clean(receipt.fingerprint);
    return{
      schema:'MPR_OBSERVATION_CONSUMPTION_PERSIST_V1',
      decision:same?'ALREADY_RECORDED':'CONFLICT',
      persisted:false,
      idempotent:same,
      key,
      validation
    };
  }
  await store.put(key,{schema:'MPR_OBSERVATION_CONSUMPTION_STORED_V1',record:receipt});
  return{
    schema:'MPR_OBSERVATION_CONSUMPTION_PERSIST_V1',
    decision:'RECORDED',
    persisted:true,
    idempotent:true,
    key,
    validation
  };
}
