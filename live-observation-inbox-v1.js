import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};
const clone=value=>JSON.parse(JSON.stringify(value??null));
const hex64=value=>/^[a-f0-9]{64}$/i.test(clean(value));

export function validateSchedulerAttestation(input={}){
  const normalized={
    executionMode:upper(input.executionMode),
    environment:clean(input.environment).toLowerCase(),
    schedulerName:clean(input.schedulerName)||null,
    runId:clean(input.runId)||null,
    triggerRef:clean(input.triggerRef)||null,
    scheduledFor:parseTime(input.scheduledFor)===null?null:new Date(parseTime(input.scheduledFor)).toISOString(),
    startedAt:parseTime(input.startedAt)===null?null:new Date(parseTime(input.startedAt)).toISOString(),
    evidenceRef:clean(input.evidenceRef)||null,
    collectorVersion:clean(input.collectorVersion)||null,
    contentSha256:clean(input.contentSha256).toLowerCase()||null
  };
  const errors=[];
  if(normalized.executionMode!=='PRODUCTION_SCHEDULED')errors.push('PRODUCTION_SCHEDULED_EXECUTION_REQUIRED');
  if(normalized.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(!normalized.schedulerName)errors.push('SCHEDULER_NAME_REQUIRED');
  if(!normalized.runId)errors.push('RUN_ID_REQUIRED');
  if(!normalized.triggerRef)errors.push('TRIGGER_REF_REQUIRED');
  if(!normalized.scheduledFor)errors.push('SCHEDULED_FOR_REQUIRED');
  if(!normalized.startedAt)errors.push('STARTED_AT_REQUIRED');
  if(!normalized.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.collectorVersion)errors.push('COLLECTOR_VERSION_REQUIRED');
  if(!hex64(normalized.contentSha256))errors.push('CONTENT_SHA256_REQUIRED');
  if(normalized.scheduledFor&&normalized.startedAt&&Date.parse(normalized.startedAt)<Date.parse(normalized.scheduledFor)-15*60*1000)errors.push('STARTED_BEFORE_SCHEDULE_WINDOW');
  return{
    schema:'MPR_SCHEDULER_ATTESTATION_VALIDATION_V1',
    ok:errors.length===0,
    decision:errors.length===0?'PRODUCTION_SCHEDULE_ATTESTED':'ATTESTATION_HOLD',
    attestation:normalized,
    errors
  };
}

export function createObservationInboxEnvelope(resolvedBundle={},options={}){
  if(!resolvedBundle?.manifest)throw new Error('RESOLVED_RANKING_SIGNAL_BUNDLE_REQUIRED');
  const receivedAt=clean(options.receivedAt)||new Date().toISOString();
  if(parseTime(receivedAt)===null)throw new Error('RECEIVED_AT_INVALID');
  const sourceFingerprint=clean(resolvedBundle.manifest.fingerprint)||deterministicFingerprint(resolvedBundle);
  const payload={
    schema:'MPR_LIVE_OBSERVATION_INBOX_ENVELOPE_V1',
    inboxId:clean(options.inboxId)||`ranking-${sourceFingerprint}`,
    sourceFingerprint,
    receivedAt:new Date(Date.parse(receivedAt)).toISOString(),
    sourceRef:clean(options.sourceRef)||null,
    channel:upper(options.channel)||'RANKING_SIGNAL_RESOLUTION',
    resolvedBundle:clone(resolvedBundle),
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function validateObservationInboxEnvelope(envelope={},options={}){
  const nowMs=parseTime(options.now||new Date().toISOString());
  const receivedMs=parseTime(envelope.receivedAt);
  const maxAgeMs=Math.max(1,Number(options.maxAgeMs||2*60*60*1000));
  const expectedFingerprint=deterministicFingerprint({
    schema:envelope.schema,
    inboxId:envelope.inboxId,
    sourceFingerprint:envelope.sourceFingerprint,
    receivedAt:envelope.receivedAt,
    sourceRef:envelope.sourceRef??null,
    channel:envelope.channel,
    resolvedBundle:envelope.resolvedBundle,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  });
  const reasons=[];
  if(envelope.schema!=='MPR_LIVE_OBSERVATION_INBOX_ENVELOPE_V1')reasons.push('INBOX_SCHEMA_INVALID');
  if(!clean(envelope.inboxId))reasons.push('INBOX_ID_REQUIRED');
  if(!clean(envelope.sourceFingerprint))reasons.push('SOURCE_FINGERPRINT_REQUIRED');
  if(!envelope?.resolvedBundle?.manifest)reasons.push('RESOLVED_RANKING_SIGNAL_BUNDLE_REQUIRED');
  if(clean(envelope?.resolvedBundle?.manifest?.fingerprint)&&clean(envelope.resolvedBundle.manifest.fingerprint)!==clean(envelope.sourceFingerprint))reasons.push('SOURCE_FINGERPRINT_MISMATCH');
  if(clean(envelope.fingerprint)!==expectedFingerprint)reasons.push('INBOX_FINGERPRINT_MISMATCH');
  if(Number(envelope.providerDataSpendEur||0)!==0||Number(envelope.paidDataCallsTriggered||0)!==0)reasons.push('PAID_DATA_ACTIVITY_BLOCKED');
  if(envelope.purchaseAuthorized!==false)reasons.push('PURCHASE_AUTHORIZATION_FORBIDDEN');
  if(Number(envelope.verifiedSalesRows||0)!==0||upper(envelope.salesEvidenceClass)!=='NOT_VERIFIED_SALES')reasons.push('TRUTH_CLASS_VIOLATION');
  let ageMs=null;
  if(nowMs===null)reasons.push('NOW_INVALID');
  if(receivedMs===null)reasons.push('RECEIVED_AT_REQUIRED');
  if(nowMs!==null&&receivedMs!==null){
    ageMs=nowMs-receivedMs;
    if(ageMs<0)reasons.push('INBOX_RECEIVED_IN_FUTURE');
    if(ageMs>maxAgeMs)reasons.push('INBOX_ENTRY_STALE');
  }
  return{
    schema:'MPR_LIVE_OBSERVATION_INBOX_VALIDATION_V1',
    valid:reasons.length===0,
    decision:reasons.length===0?'READY':'HOLD',
    ageMs,
    maxAgeMs,
    reasons
  };
}

export async function enqueueObservationBundle(store,resolvedBundle={},options={}){
  if(!store||typeof store.get!=='function'||typeof store.put!=='function')throw new Error('OBSERVATION_INBOX_STORE_REQUIRED');
  const envelope=createObservationInboxEnvelope(resolvedBundle,options);
  const key=clean(options.key)||`live-observation-inbox/${envelope.inboxId}`;
  const existing=await store.get(key);
  if(existing){
    const same=clean(existing?.record?.fingerprint||existing?.fingerprint)===envelope.fingerprint;
    return{
      schema:'MPR_LIVE_OBSERVATION_INBOX_ENQUEUE_V1',
      decision:same?'ALREADY_ENQUEUED':'CONFLICT',
      key,
      enqueued:false,
      idempotent:same,
      envelope
    };
  }
  const stored={schema:'MPR_LIVE_OBSERVATION_INBOX_STORED_V1',record:envelope};
  await store.put(key,stored);
  return{
    schema:'MPR_LIVE_OBSERVATION_INBOX_ENQUEUE_V1',
    decision:'ENQUEUED',
    key,
    enqueued:true,
    idempotent:true,
    envelope
  };
}

export async function readObservationInboxEntry(store,key,options={}){
  if(!store||typeof store.get!=='function')throw new Error('OBSERVATION_INBOX_STORE_REQUIRED');
  const stored=await store.get(key);
  const envelope=stored?.record??stored??null;
  if(!envelope)return{
    schema:'MPR_LIVE_OBSERVATION_INBOX_READ_V1',
    decision:'WAIT',
    found:false,
    validation:{valid:false,reasons:['INBOX_ENTRY_NOT_FOUND']}
  };
  const validation=validateObservationInboxEnvelope(envelope,options);
  const schedulerValidation=options.schedulerAttestation?validateSchedulerAttestation(options.schedulerAttestation):null;
  const productionRunnable=validation.valid&&schedulerValidation?.ok===true;
  return{
    schema:'MPR_LIVE_OBSERVATION_INBOX_READ_V1',
    decision:validation.valid?'READY':'WAIT',
    found:true,
    validation,
    schedulerAttestation:schedulerValidation,
    analysisRunnable:validation.valid,
    productionRunnable,
    envelope
  };
}
