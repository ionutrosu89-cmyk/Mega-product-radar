import crypto from 'node:crypto';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {createIngestionCheckpoint,validateProductionAttestation} from './production-readiness-harness-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));

export function serializeCheckpointEnvelope(checkpoint={},options={}){
  const normalized=createIngestionCheckpoint(checkpoint);
  const payload={
    schema:'MPR_PERSISTED_CHECKPOINT_V1',
    storageMode:upper(options.storageMode)||'LOCAL_FILE',
    storageRef:clean(options.storageRef)||null,
    writtenAt:iso(options.writtenAt)||null,
    checkpoint:normalized
  };
  const content=JSON.stringify(payload);
  return{
    ...payload,
    contentSha256:crypto.createHash('sha256').update(content).digest('hex'),
    content
  };
}

export function verifyPersistedCheckpoint(original={},restored={},options={}){
  const first=serializeCheckpointEnvelope(original,options.original||{});
  const second=serializeCheckpointEnvelope(restored,options.restored||options.original||{});
  const attestation=validateProductionAttestation(options.attestation||{});
  const stateMatch=first.checkpoint.checkpointFingerprint===second.checkpoint.checkpointFingerprint;
  const contentHashMatch=first.contentSha256===second.contentSha256;
  const productionStorage=first.storageMode==='PRODUCTION_PERSISTENCE'&&second.storageMode==='PRODUCTION_PERSISTENCE';
  const storageRefMatch=Boolean(first.storageRef&&second.storageRef&&first.storageRef===second.storageRef);
  const attestedStorageRefMatch=Boolean(attestation.attestation.evidenceRef&&first.storageRef===attestation.attestation.evidenceRef);
  const productionPersistenceVerified=stateMatch&&contentHashMatch&&productionStorage&&storageRefMatch&&attestedStorageRefMatch&&attestation.ok;
  return{
    schema:'MPR_PERSISTED_CHECKPOINT_VERIFICATION_V1',
    stateMatch,
    contentHashMatch,
    productionStorage,
    storageRefMatch,
    attestedStorageRefMatch,
    productionAttestationValid:attestation.ok,
    attestationErrors:attestation.errors,
    productionPersistenceVerified,
    decision:productionPersistenceVerified?'PERSISTENCE_VERIFIED':'PERSISTENCE_NOT_PROVEN',
    originalContentSha256:first.contentSha256,
    restoredContentSha256:second.contentSha256
  };
}

export function normalizeWorkerHeartbeat(input={},options={}){
  const snapshotAt=iso(options.snapshotAt);
  const observedAt=iso(input.observedAt);
  const processed=Math.max(0,Number(input.processed||0));
  const failed=Math.max(0,Number(input.failed||0));
  const failureRate=(processed+failed)>0?failed/(processed+failed):0;
  const heartbeatAgeMs=snapshotAt&&observedAt?Math.max(0,Date.parse(snapshotAt)-Date.parse(observedAt)):null;
  const payload={
    schema:'MPR_WORKER_HEARTBEAT_V1',
    workerId:clean(input.workerId||input.id)||null,
    status:upper(input.status)||'UNKNOWN',
    observedAt,
    processed,
    failed,
    failureRate,
    queueDepth:Math.max(0,Number(input.queueDepth||0)),
    oldestQueueAgeMs:Math.max(0,Number(input.oldestQueueAgeMs||0)),
    heartbeatAgeMs,
    runId:clean(input.runId)||null,
    collectorVersion:clean(input.collectorVersion)||null
  };
  return{...payload,fingerprint:deterministicFingerprint(payload)};
}

export function evaluateTelemetrySnapshot(heartbeats=[],options={}){
  const snapshotAt=iso(options.snapshotAt);
  const attestation=validateProductionAttestation(options.attestation||{});
  const maxHeartbeatAgeMs=Math.max(1,Number(options.maxHeartbeatAgeMs||60000));
  const maxFailureRate=Math.max(0,Number(options.maxFailureRate??0.01));
  const maxQueueDepth=Math.max(0,Number(options.maxQueueDepth??1000));
  const maxOldestQueueAgeMs=Math.max(0,Number(options.maxOldestQueueAgeMs??60000));
  const normalized=heartbeats.map(x=>normalizeWorkerHeartbeat(x,{snapshotAt}));
  const workers=normalized.map(worker=>{
    const checks={
      identityPresent:Boolean(worker.workerId),
      observedAtPresent:Boolean(worker.observedAt),
      healthyStatus:worker.status==='HEALTHY',
      heartbeatFresh:worker.heartbeatAgeMs!==null&&worker.heartbeatAgeMs<=maxHeartbeatAgeMs,
      failureRateWithinLimit:worker.failureRate<=maxFailureRate,
      queueDepthWithinLimit:worker.queueDepth<=maxQueueDepth,
      queueAgeWithinLimit:worker.oldestQueueAgeMs<=maxOldestQueueAgeMs
    };
    return{...worker,checks,healthy:Object.values(checks).every(Boolean)};
  });
  const locallyHealthy=workers.length>0&&workers.every(x=>x.healthy);
  const productionStable=locallyHealthy&&attestation.ok;
  const snapshot={
    schema:'MPR_TELEMETRY_SNAPSHOT_V1',
    snapshotAt,
    workerCount:workers.length,
    healthyWorkerCount:workers.filter(x=>x.healthy).length,
    locallyHealthy,
    productionAttestationValid:attestation.ok,
    attestationErrors:attestation.errors,
    productionStable,
    decision:productionStable?'PRODUCTION_TELEMETRY_STABLE':'PRODUCTION_TELEMETRY_NOT_PROVEN',
    limits:{maxHeartbeatAgeMs,maxFailureRate,maxQueueDepth,maxOldestQueueAgeMs},
    workers
  };
  return{...snapshot,fingerprint:deterministicFingerprint(snapshot)};
}

export function buildProgressiveCapacityPlan(options={}){
  const stages=Array.isArray(options.stages)&&options.stages.length?options.stages:[10000,100000,1000000];
  const chunkSize=Math.max(100,Number(options.chunkSize||10000));
  return stages.map((target,index)=>({
    stage:index===0?'10K':index===1?'100K':index===2?'1M':`STAGE_${index+1}`,
    targetCanonicalCount:Math.max(1,Number(target)),
    chunkSize,
    estimatedChunks:Math.ceil(Math.max(1,Number(target))/chunkSize),
    evidenceClass:'LOCAL_SYNTHETIC_CAPACITY_EXERCISE',
    productionEvidence:false
  }));
}

export function createSyntheticCapacityCheckpoint(input={}){
  const targetCanonicalCount=Math.max(1,Number(input.targetCanonicalCount||0));
  const processedCount=Math.max(0,Math.min(targetCanonicalCount,Number(input.processedCount||0)));
  const seed=clean(input.seed)||'MPR_SYNTHETIC_CAPACITY_V1';
  const ingestionFingerprint=crypto.createHash('sha256').update(`${seed}:${targetCanonicalCount}:${processedCount}`).digest('hex');
  const artifactContentSha256=crypto.createHash('sha256').update(`${ingestionFingerprint}:artifact`).digest('hex');
  return createIngestionCheckpoint({
    runId:clean(input.runId)||'LOCAL_SYNTHETIC_CAPACITY',
    sequence:Math.max(0,Number(input.sequence||0)),
    processedCount,
    canonicalCount:processedCount,
    cursor:`SYNTHETIC:${processedCount}`,
    ingestionFingerprint,
    artifactContentSha256
  });
}

export function validateExternalEvidenceRecord(record={}){
  const attestation=validateProductionAttestation(record.attestation||{});
  const contentSha256=clean(record.contentSha256).toLowerCase();
  const errors=[...attestation.errors];
  if(!clean(record.evidenceType))errors.push('EVIDENCE_TYPE_REQUIRED');
  if(!clean(record.evidenceRef))errors.push('EVIDENCE_REF_REQUIRED');
  if(!sha256(contentSha256))errors.push('EVIDENCE_CONTENT_SHA256_REQUIRED');
  if(attestation.attestation.evidenceRef&&clean(record.evidenceRef)!==attestation.attestation.evidenceRef)errors.push('EVIDENCE_REF_MISMATCH');
  return{
    ok:errors.length===0,
    errors,
    record:{
      evidenceType:upper(record.evidenceType)||null,
      evidenceRef:clean(record.evidenceRef)||null,
      contentSha256:contentSha256||null,
      attestation:attestation.attestation
    }
  };
}
