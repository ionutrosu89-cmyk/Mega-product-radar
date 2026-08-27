import crypto from 'node:crypto';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}

export function createWorkerTelemetrySnapshot(input={}){
  const observedAt=iso(input.observedAt)||new Date(0).toISOString();
  const observedAtMs=Date.parse(observedAt);
  const workers=(input.workers||[]).map((worker,index)=>{
    const heartbeatAt=iso(worker.heartbeatAt);
    const heartbeatAgeMs=heartbeatAt?Math.max(0,observedAtMs-Date.parse(heartbeatAt)):Number.POSITIVE_INFINITY;
    const processed=Math.max(0,Number(worker.processed||0));
    const failed=Math.max(0,Number(worker.failed||0));
    const total=processed+failed;
    return{
      id:clean(worker.id)||`worker-${index+1}`,
      status:clean(worker.status).toUpperCase()||'UNKNOWN',
      heartbeatAt,
      heartbeatAgeMs:Number.isFinite(heartbeatAgeMs)?heartbeatAgeMs:null,
      processed,
      failed,
      failureRate:total>0?failed/total:0,
      queueDepth:Math.max(0,Number(worker.queueDepth||0)),
      oldestMessageAgeMs:Math.max(0,Number(worker.oldestMessageAgeMs||0))
    };
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const payload={
    schema:'MPR_WORKER_TELEMETRY_SNAPSHOT_V1',
    observedAt,
    collectorVersion:clean(input.collectorVersion)||null,
    runtimeRef:clean(input.runtimeRef)||null,
    workers
  };
  const serialized=JSON.stringify(stable(payload));
  return{
    ...payload,
    contentSha256:hash(serialized),
    snapshotFingerprint:deterministicFingerprint(payload)
  };
}

export function validateWorkerTelemetryAttestation(input={},snapshot={}){
  const normalized={
    schema:clean(input.schema),
    observationMode:clean(input.observationMode).toUpperCase(),
    environment:clean(input.environment).toLowerCase(),
    sourceKind:clean(input.sourceKind).toUpperCase(),
    evidenceRef:clean(input.evidenceRef)||null,
    observedAt:iso(input.observedAt),
    collectorVersion:clean(input.collectorVersion)||null,
    runtimeRef:clean(input.runtimeRef)||null,
    contentSha256:clean(input.contentSha256).toLowerCase()||null
  };
  const errors=[];
  if(normalized.schema!=='MPR_WORKER_TELEMETRY_ATTESTATION_V1')errors.push('WORKER_TELEMETRY_ATTESTATION_SCHEMA_REQUIRED');
  if(normalized.observationMode!=='PRODUCTION_OBSERVED')errors.push('PRODUCTION_OBSERVATION_REQUIRED');
  if(normalized.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(!['PRODUCTION_WORKER_RUNTIME','PRODUCTION_QUEUE_RUNTIME'].includes(normalized.sourceKind))errors.push('PRODUCTION_TELEMETRY_SOURCE_REQUIRED');
  if(!normalized.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.observedAt)errors.push('OBSERVED_AT_REQUIRED');
  if(!normalized.collectorVersion)errors.push('COLLECTOR_VERSION_REQUIRED');
  if(!normalized.runtimeRef)errors.push('RUNTIME_REF_REQUIRED');
  if(!sha256(normalized.contentSha256))errors.push('CONTENT_SHA256_REQUIRED');
  if(snapshot.contentSha256&&normalized.contentSha256!==snapshot.contentSha256)errors.push('TELEMETRY_HASH_BINDING_MISMATCH');
  if(snapshot.observedAt&&normalized.observedAt!==snapshot.observedAt)errors.push('TELEMETRY_OBSERVED_AT_MISMATCH');
  if(snapshot.collectorVersion&&normalized.collectorVersion!==snapshot.collectorVersion)errors.push('TELEMETRY_COLLECTOR_MISMATCH');
  if(snapshot.runtimeRef&&normalized.runtimeRef!==snapshot.runtimeRef)errors.push('TELEMETRY_RUNTIME_REF_MISMATCH');
  return{ok:errors.length===0,errors,attestation:normalized};
}

export function evaluateWorkerTelemetryEvidence(input={},options={}){
  const snapshot=createWorkerTelemetrySnapshot(input.snapshot||input);
  const attestation=validateWorkerTelemetryAttestation(input.attestation||{},snapshot);
  const maxHeartbeatAgeMs=Math.max(1,Number(options.maxHeartbeatAgeMs||60000));
  const maxFailureRate=Math.max(0,Number(options.maxFailureRate??0.01));
  const maxQueueDepth=Math.max(0,Number(options.maxQueueDepth??1000));
  const maxOldestMessageAgeMs=Math.max(0,Number(options.maxOldestMessageAgeMs??60000));
  const evaluated=snapshot.workers.map(worker=>{
    const heartbeatFresh=worker.heartbeatAgeMs!==null&&worker.heartbeatAgeMs<=maxHeartbeatAgeMs;
    const failureRateOk=worker.failureRate<=maxFailureRate;
    const queueDepthOk=worker.queueDepth<=maxQueueDepth;
    const oldestMessageAgeOk=worker.oldestMessageAgeMs<=maxOldestMessageAgeMs;
    const healthy=worker.status==='HEALTHY'&&heartbeatFresh&&failureRateOk&&queueDepthOk&&oldestMessageAgeOk;
    return{...worker,heartbeatFresh,failureRateOk,queueDepthOk,oldestMessageAgeOk,healthy};
  });
  const localHealthVerified=evaluated.length>0&&evaluated.every(worker=>worker.healthy);
  const productionQueuesStable=localHealthVerified&&attestation.ok;
  const reasons=[];
  if(!evaluated.length)reasons.push('WORKER_TELEMETRY_REQUIRED');
  if(evaluated.length&&!localHealthVerified)reasons.push('WORKER_HEALTH_THRESHOLDS_FAILED');
  if(!attestation.ok)reasons.push(...attestation.errors);
  const evidence={
    schema:'MPR_WORKER_TELEMETRY_EVIDENCE_V1',
    decision:productionQueuesStable?'PRODUCTION_QUEUES_STABLE':'HOLD_PRODUCTION_QUEUES',
    queuesStable:productionQueuesStable,
    localHealthVerified,
    productionTelemetryAttestationValid:attestation.ok,
    workerCount:evaluated.length,
    healthyWorkerCount:evaluated.filter(worker=>worker.healthy).length,
    thresholds:{maxHeartbeatAgeMs,maxFailureRate,maxQueueDepth,maxOldestMessageAgeMs},
    snapshot:{...snapshot,workers:evaluated},
    attestationErrors:attestation.errors,
    reasons,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...evidence,evidenceFingerprint:deterministicFingerprint(evidence)};
}
