import {deterministicFingerprint,evaluateScaleGate} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;

export const SCALE_STAGES=Object.freeze([
  {name:'10K',requiredCanonicalCount:10000},
  {name:'100K',requiredCanonicalCount:100000},
  {name:'1M',requiredCanonicalCount:1000000}
]);

export function validateProductionAttestation(input={}){
  const normalized={
    observationMode:clean(input.observationMode).toUpperCase(),
    environment:clean(input.environment).toLowerCase(),
    evidenceRef:clean(input.evidenceRef)||null,
    observedAt:iso(input.observedAt),
    collectorVersion:clean(input.collectorVersion)||null,
    contentSha256:clean(input.contentSha256).toLowerCase()||null
  };
  const errors=[];
  if(normalized.observationMode!=='PRODUCTION_OBSERVED')errors.push('PRODUCTION_OBSERVATION_REQUIRED');
  if(normalized.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(!normalized.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.observedAt)errors.push('OBSERVED_AT_REQUIRED');
  if(!normalized.collectorVersion)errors.push('COLLECTOR_VERSION_REQUIRED');
  if(!sha256(normalized.contentSha256))errors.push('CONTENT_SHA256_REQUIRED');
  return{ok:errors.length===0,errors,attestation:normalized};
}

export function createIngestionCheckpoint(input={}){
  const payload={
    schema:'MPR_INGESTION_CHECKPOINT_V1',
    runId:clean(input.runId)||null,
    sequence:Math.max(0,Number(input.sequence||0)),
    processedCount:Math.max(0,Number(input.processedCount||0)),
    canonicalCount:Math.max(0,Number(input.canonicalCount||0)),
    cursor:clean(input.cursor)||null,
    ingestionFingerprint:clean(input.ingestionFingerprint)||null,
    artifactContentSha256:clean(input.artifactContentSha256).toLowerCase()||null
  };
  return{...payload,checkpointFingerprint:deterministicFingerprint(payload)};
}

export function verifyCheckpointRestore(original={},restored={},options={}){
  const first=createIngestionCheckpoint(original);
  const second=createIngestionCheckpoint(restored);
  const attestation=validateProductionAttestation(options.attestation||{});
  const checkpointMatch=first.checkpointFingerprint===second.checkpointFingerprint;
  const artifactHashValid=sha256(first.artifactContentSha256)&&first.artifactContentSha256===second.artifactContentSha256;
  const verified=checkpointMatch&&artifactHashValid&&attestation.ok;
  return{
    schema:'MPR_CHECKPOINT_RESTORE_VERIFICATION_V1',
    verified,
    checkpointMatch,
    artifactHashValid,
    productionAttestationValid:attestation.ok,
    attestationErrors:attestation.errors,
    originalCheckpointFingerprint:first.checkpointFingerprint,
    restoredCheckpointFingerprint:second.checkpointFingerprint,
    restoreVerified:verified
  };
}

export function evaluateWorkerFleetHealth(workers=[],options={}){
  const attestation=validateProductionAttestation(options.attestation||{});
  const maxHeartbeatAgeMs=Math.max(1,Number(options.maxHeartbeatAgeMs||60000));
  const maxFailureRate=Math.max(0,Number(options.maxFailureRate??0.01));
  const normalized=workers.map((worker,index)=>{
    const processed=Math.max(0,Number(worker.processed||0));
    const failed=Math.max(0,Number(worker.failed||0));
    const failureRate=(processed+failed)>0?failed/(processed+failed):0;
    const heartbeatAgeMs=Math.max(0,Number(worker.heartbeatAgeMs||0));
    const healthy=clean(worker.status).toUpperCase()==='HEALTHY'&&heartbeatAgeMs<=maxHeartbeatAgeMs&&failureRate<=maxFailureRate;
    return{index,id:clean(worker.id)||`worker-${index+1}`,processed,failed,failureRate,heartbeatAgeMs,healthy};
  });
  const allHealthy=normalized.length>0&&normalized.every(x=>x.healthy);
  const queuesStable=allHealthy&&attestation.ok;
  return{
    schema:'MPR_WORKER_FLEET_HEALTH_V1',
    workerCount:normalized.length,
    healthyWorkerCount:normalized.filter(x=>x.healthy).length,
    allHealthy,
    productionAttestationValid:attestation.ok,
    attestationErrors:attestation.errors,
    queuesStable,
    decision:queuesStable?'WORKER_FLEET_STABLE':'WORKER_FLEET_NOT_PROVEN',
    workers:normalized
  };
}

export function evaluateProgressiveScaleStage(input={},options={}){
  const stage=SCALE_STAGES.find(x=>x.name===clean(options.stage).toUpperCase())||SCALE_STAGES[0];
  const canonicalCount=Math.max(0,Number(input.canonicalCount||0));
  const latencyAttestation=validateProductionAttestation(input.latencyAttestation||{});
  const p95Ms=finite(input.p95Ms);
  const p95LimitMs=Math.max(1,Number(options.p95LimitMs||1000));
  const checks={
    canonicalVolume:canonicalCount>=stage.requiredCanonicalCount,
    zeroLogicalDuplicates:Number(input.logicalDuplicateCount||0)===0,
    provenanceComplete:input.provenanceComplete===true,
    replayDeterministic:input.replayDeterministic===true,
    restoreVerified:input.restoreVerified===true,
    queuesStable:input.queuesStable===true,
    p95ProductionObserved:latencyAttestation.ok,
    p95Acceptable:p95Ms!==null&&p95Ms<=p95LimitMs
  };
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return{
    schema:'MPR_PROGRESSIVE_SCALE_STAGE_V1',
    stage:stage.name,
    requiredCanonicalCount:stage.requiredCanonicalCount,
    canonicalCount,
    p95Ms,
    p95LimitMs,
    checks,
    failed,
    decision:failed.length?'HOLD_STAGE':'STAGE_READY',
    stageAuthorized:failed.length===0
  };
}

export function buildProductionReadinessSnapshot(input={},options={}){
  const fleet=evaluateWorkerFleetHealth(input.workers||[],{...options,attestation:input.workerAttestation||{}});
  const restore=verifyCheckpointRestore(input.originalCheckpoint||{},input.restoredCheckpoint||{}, {attestation:input.restoreAttestation||{}});
  const stage=evaluateProgressiveScaleStage({
    canonicalCount:input.canonicalCount,
    logicalDuplicateCount:input.logicalDuplicateCount,
    provenanceComplete:input.provenanceComplete,
    replayDeterministic:input.replayDeterministic,
    restoreVerified:restore.restoreVerified,
    queuesStable:fleet.queuesStable,
    p95Ms:input.p95Ms,
    latencyAttestation:input.latencyAttestation
  },{stage:options.stage||'1M',p95LimitMs:options.p95LimitMs||1000});
  const finalScale=evaluateScaleGate({manifest:{canonicalCount:Number(input.canonicalCount||0),logicalDuplicateCount:Number(input.logicalDuplicateCount||0)}},{
    requiredCanonicalCount:1000000,
    provenanceComplete:input.provenanceComplete===true,
    restoreVerified:restore.restoreVerified,
    replayDeterministic:input.replayDeterministic===true,
    queuesStable:fleet.queuesStable,
    p95Ms:validateProductionAttestation(input.latencyAttestation||{}).ok?finite(input.p95Ms):null,
    p95LimitMs:options.p95LimitMs||1000
  });
  const snapshot={
    schema:'MPR_PRODUCTION_READINESS_SNAPSHOT_V1',
    fleet,
    restore,
    stage,
    finalScale,
    productionReady:finalScale.decision==='SCALE_READY',
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false
  };
  return{...snapshot,fingerprint:deterministicFingerprint(snapshot)};
}
