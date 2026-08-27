import {deterministicFingerprint,evaluateScaleGate} from './data-pipeline-core-v1.js';
import {createWorkerTelemetrySnapshot,validateWorkerTelemetryAttestation} from './production-worker-telemetry-evidence-v1.js';
import {createLatencySnapshot,validateLatencyAttestation} from './production-latency-evidence-v1.js';

const clean=value=>String(value??'').trim();
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;

export const SCALE_STAGES=Object.freeze([
  {name:'10K',requiredCanonicalCount:10000},
  {name:'100K',requiredCanonicalCount:100000},
  {name:'1M',requiredCanonicalCount:1000000}
]);

export function validateProductionAttestation(input={}){
  const normalized={observationMode:clean(input.observationMode).toUpperCase(),environment:clean(input.environment).toLowerCase(),evidenceRef:clean(input.evidenceRef)||null,observedAt:iso(input.observedAt),collectorVersion:clean(input.collectorVersion)||null,contentSha256:clean(input.contentSha256).toLowerCase()||null};
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
  const payload={schema:'MPR_INGESTION_CHECKPOINT_V1',runId:clean(input.runId)||null,sequence:Math.max(0,Number(input.sequence||0)),processedCount:Math.max(0,Number(input.processedCount||0)),canonicalCount:Math.max(0,Number(input.canonicalCount||0)),cursor:clean(input.cursor)||null,ingestionFingerprint:clean(input.ingestionFingerprint)||null,artifactContentSha256:clean(input.artifactContentSha256).toLowerCase()||null};
  return{...payload,checkpointFingerprint:deterministicFingerprint(payload)};
}

export function verifyCheckpointRestore(original={},restored={},options={}){
  const first=createIngestionCheckpoint(original),second=createIngestionCheckpoint(restored),attestation=validateProductionAttestation(options.attestation||{});
  const checkpointMatch=first.checkpointFingerprint===second.checkpointFingerprint;
  const artifactHashValid=sha256(first.artifactContentSha256)&&first.artifactContentSha256===second.artifactContentSha256;
  const verified=checkpointMatch&&artifactHashValid&&attestation.ok;
  return{schema:'MPR_CHECKPOINT_RESTORE_VERIFICATION_V1',verified,checkpointMatch,artifactHashValid,productionAttestationValid:attestation.ok,attestationErrors:attestation.errors,originalCheckpointFingerprint:first.checkpointFingerprint,restoredCheckpointFingerprint:second.checkpointFingerprint,restoreVerified:verified};
}

export function evaluateReadinessRestoreGate(input={}){
  const evidence=input.persistenceRestoreEvidence||{};
  const schemaOk=clean(evidence.schema)==='MPR_PERSISTENCE_RESTORE_EVIDENCE_V1';
  const decisionOk=clean(evidence.decision)==='PRODUCTION_RESTORE_VERIFIED';
  const persistedHash=clean(evidence.persistedContentSha256).toLowerCase(),restoredHash=clean(evidence.restoredContentSha256).toLowerCase();
  const hashesValid=sha256(persistedHash)&&sha256(restoredHash)&&persistedHash===restoredHash;
  const checkpointFingerprintPresent=clean(evidence.checkpointFingerprint).length>0;
  const restoreVerified=schemaOk&&decisionOk&&evidence.productionRestoreVerified===true&&evidence.localRestoreVerified===true&&hashesValid&&checkpointFingerprintPresent;
  const reasons=[];
  if(!schemaOk)reasons.push('PRODUCTION_PERSISTENCE_RESTORE_EVIDENCE_REQUIRED');
  if(schemaOk&&!decisionOk)reasons.push('PRODUCTION_RESTORE_DECISION_REQUIRED');
  if(schemaOk&&evidence.productionRestoreVerified!==true)reasons.push('PRODUCTION_RESTORE_VERIFICATION_REQUIRED');
  if(schemaOk&&evidence.localRestoreVerified!==true)reasons.push('RESTORE_INTEGRITY_REQUIRED');
  if(schemaOk&&!hashesValid)reasons.push('RESTORE_HASH_BINDING_REQUIRED');
  if(schemaOk&&!checkpointFingerprintPresent)reasons.push('CHECKPOINT_FINGERPRINT_REQUIRED');
  return{schema:'MPR_READINESS_RESTORE_GATE_V1',restoreVerified,decision:restoreVerified?'RESTORE_GATE_READY':'HOLD_RESTORE_GATE',source:schemaOk?'PERSISTENCE_RESTORE_EVIDENCE_V1':'NONE',reasons,evidenceSchema:schemaOk?evidence.schema:null,checkpointFingerprint:checkpointFingerprintPresent?clean(evidence.checkpointFingerprint):null,persistedContentSha256:sha256(persistedHash)?persistedHash:null,restoredContentSha256:sha256(restoredHash)?restoredHash:null};
}

export function evaluateWorkerFleetHealth(workers=[],options={}){
  const attestation=validateProductionAttestation(options.attestation||{}),maxHeartbeatAgeMs=Math.max(1,Number(options.maxHeartbeatAgeMs||60000)),maxFailureRate=Math.max(0,Number(options.maxFailureRate??0.01));
  const normalized=workers.map((worker,index)=>{const processed=Math.max(0,Number(worker.processed||0)),failed=Math.max(0,Number(worker.failed||0)),failureRate=(processed+failed)>0?failed/(processed+failed):0,heartbeatAgeMs=Math.max(0,Number(worker.heartbeatAgeMs||0));return{index,id:clean(worker.id)||`worker-${index+1}`,processed,failed,failureRate,heartbeatAgeMs,healthy:clean(worker.status).toUpperCase()==='HEALTHY'&&heartbeatAgeMs<=maxHeartbeatAgeMs&&failureRate<=maxFailureRate};});
  const allHealthy=normalized.length>0&&normalized.every(x=>x.healthy),queuesStable=allHealthy&&attestation.ok;
  return{schema:'MPR_WORKER_FLEET_HEALTH_V1',workerCount:normalized.length,healthyWorkerCount:normalized.filter(x=>x.healthy).length,allHealthy,productionAttestationValid:attestation.ok,attestationErrors:attestation.errors,queuesStable,decision:queuesStable?'WORKER_FLEET_STABLE':'WORKER_FLEET_NOT_PROVEN',workers:normalized};
}

export function evaluateReadinessQueueGate(input={}){
  const evidence=input.workerTelemetryEvidence||{},schemaOk=clean(evidence.schema)==='MPR_WORKER_TELEMETRY_EVIDENCE_V1',decisionOk=clean(evidence.decision)==='PRODUCTION_QUEUES_STABLE',workerCount=Math.max(0,Number(evidence.workerCount||0)),healthyWorkerCount=Math.max(0,Number(evidence.healthyWorkerCount||0));
  const snapshot=evidence.snapshot||{},snapshotHash=clean(snapshot.contentSha256).toLowerCase(),recomputedSnapshot=createWorkerTelemetrySnapshot(snapshot),snapshotIntegrity=sha256(snapshotHash)&&snapshotHash===recomputedSnapshot.contentSha256&&clean(snapshot.snapshotFingerprint)===recomputedSnapshot.snapshotFingerprint;
  const evidenceBase={...evidence};delete evidenceBase.evidenceFingerprint;
  const evidenceIntegrity=clean(evidence.evidenceFingerprint).length>0&&clean(evidence.evidenceFingerprint)===deterministicFingerprint(evidenceBase),attestation=validateWorkerTelemetryAttestation(evidence.attestation||{},snapshot);
  const safetyBoundaries=Number(evidence.providerDataSpendEur||0)===0&&Number(evidence.paidDataCallsTriggered||0)===0&&evidence.purchaseAuthorized===false&&Number(evidence.verifiedSalesRows||0)===0&&clean(evidence.salesEvidenceClass)==='NOT_VERIFIED_SALES';
  const queuesStable=schemaOk&&decisionOk&&evidence.queuesStable===true&&evidence.localHealthVerified===true&&workerCount>0&&healthyWorkerCount===workerCount&&snapshotIntegrity&&evidenceIntegrity&&attestation.ok&&safetyBoundaries;
  const reasons=[];
  if(!schemaOk)reasons.push('PRODUCTION_WORKER_TELEMETRY_EVIDENCE_REQUIRED');
  if(schemaOk&&!decisionOk)reasons.push('PRODUCTION_QUEUE_DECISION_REQUIRED');
  if(schemaOk&&!queuesStable)reasons.push('PRODUCTION_QUEUE_EVIDENCE_NOT_VERIFIED');
  return{schema:'MPR_READINESS_QUEUE_GATE_V1',queuesStable,decision:queuesStable?'QUEUE_GATE_READY':'HOLD_QUEUE_GATE',source:schemaOk?'WORKER_TELEMETRY_EVIDENCE_V1':'NONE',reasons,workerCount,healthyWorkerCount,snapshotIntegrity,evidenceIntegrity,runtimeRef:attestation.attestation.runtimeRef||null,evidenceRef:attestation.attestation.evidenceRef||null};
}

export function evaluateReadinessLatencyGate(input={},options={}){
  const evidence=input.latencyEvidence||{},schemaOk=clean(evidence.schema)==='MPR_LATENCY_EVIDENCE_V1',decisionOk=clean(evidence.decision)==='PRODUCTION_P95_VERIFIED';
  const snapshot=evidence.snapshot||{},recomputed=createLatencySnapshot(snapshot),snapshotIntegrity=clean(snapshot.contentSha256)===recomputed.contentSha256&&clean(snapshot.snapshotFingerprint)===recomputed.snapshotFingerprint;
  const base={...evidence};delete base.evidenceFingerprint;
  const evidenceIntegrity=clean(evidence.evidenceFingerprint).length>0&&clean(evidence.evidenceFingerprint)===deterministicFingerprint(base);
  const attestation=validateLatencyAttestation(evidence.attestation||{},snapshot),p95LimitMs=Math.max(1,Number(options.p95LimitMs||1000));
  const sampleCountValid=Number(evidence.sampleCount||0)>=Number(evidence.minSampleCount||100)&&Number(evidence.sampleCount||0)===Number(snapshot.sampleCount||0);
  const p95Ms=Number.isFinite(Number(snapshot.p95Ms))?Number(snapshot.p95Ms):null;
  const p95Acceptable=p95Ms!==null&&p95Ms<=p95LimitMs&&p95Ms===Number(evidence.p95Ms);
  const safetyBoundaries=Number(evidence.providerDataSpendEur||0)===0&&Number(evidence.paidDataCallsTriggered||0)===0&&evidence.purchaseAuthorized===false&&Number(evidence.verifiedSalesRows||0)===0&&clean(evidence.salesEvidenceClass)==='NOT_VERIFIED_SALES';
  const p95Verified=schemaOk&&decisionOk&&evidence.productionP95Verified===true&&evidence.localLatencyVerified===true&&snapshotIntegrity&&evidenceIntegrity&&attestation.ok&&sampleCountValid&&p95Acceptable&&safetyBoundaries;
  const reasons=[];
  if(!schemaOk)reasons.push('PRODUCTION_LATENCY_EVIDENCE_REQUIRED');
  if(schemaOk&&!decisionOk)reasons.push('PRODUCTION_P95_DECISION_REQUIRED');
  if(schemaOk&&!snapshotIntegrity)reasons.push('LATENCY_SNAPSHOT_INTEGRITY_REQUIRED');
  if(schemaOk&&!evidenceIntegrity)reasons.push('LATENCY_EVIDENCE_INTEGRITY_REQUIRED');
  if(schemaOk&&!sampleCountValid)reasons.push('LATENCY_SAMPLE_COUNT_REQUIRED');
  if(schemaOk&&!p95Acceptable)reasons.push('P95_LIMIT_REQUIRED');
  if(schemaOk&&!attestation.ok)reasons.push(...attestation.errors);
  if(schemaOk&&!safetyBoundaries)reasons.push('LATENCY_SAFETY_BOUNDARY_FAILED');
  return{schema:'MPR_READINESS_LATENCY_GATE_V1',p95Verified,decision:p95Verified?'LATENCY_GATE_READY':'HOLD_LATENCY_GATE',source:schemaOk?'LATENCY_EVIDENCE_V1':'NONE',reasons,p95Ms,p95LimitMs,sampleCount:Number(snapshot.sampleCount||0),snapshotIntegrity,evidenceIntegrity,runtimeRef:attestation.attestation.runtimeRef||null,evidenceRef:attestation.attestation.evidenceRef||null};
}

export function evaluateProgressiveScaleStage(input={},options={}){
  const stage=SCALE_STAGES.find(x=>x.name===clean(options.stage).toUpperCase())||SCALE_STAGES[0],canonicalCount=Math.max(0,Number(input.canonicalCount||0)),p95LimitMs=Math.max(1,Number(options.p95LimitMs||1000));
  const checks={canonicalVolume:canonicalCount>=stage.requiredCanonicalCount,zeroLogicalDuplicates:Number(input.logicalDuplicateCount||0)===0,provenanceComplete:input.provenanceComplete===true,replayDeterministic:input.replayDeterministic===true,restoreVerified:input.restoreVerified===true,queuesStable:input.queuesStable===true,p95ProductionObserved:input.p95Verified===true,p95Acceptable:Number.isFinite(Number(input.p95Ms))&&Number(input.p95Ms)<=p95LimitMs};
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return{schema:'MPR_PROGRESSIVE_SCALE_STAGE_V1',stage:stage.name,requiredCanonicalCount:stage.requiredCanonicalCount,canonicalCount,p95Ms:Number.isFinite(Number(input.p95Ms))?Number(input.p95Ms):null,p95LimitMs,checks,failed,decision:failed.length?'HOLD_STAGE':'STAGE_READY',stageAuthorized:failed.length===0};
}

export function buildProductionReadinessSnapshot(input={},options={}){
  const legacyFleet=evaluateWorkerFleetHealth(input.workers||[],{...options,attestation:input.workerAttestation||{}}),queue=evaluateReadinessQueueGate(input),legacyRestore=verifyCheckpointRestore(input.originalCheckpoint||{},input.restoredCheckpoint||{},{attestation:input.restoreAttestation||{}}),restore=evaluateReadinessRestoreGate(input),latency=evaluateReadinessLatencyGate(input,{p95LimitMs:options.p95LimitMs||1000});
  const stage=evaluateProgressiveScaleStage({canonicalCount:input.canonicalCount,logicalDuplicateCount:input.logicalDuplicateCount,provenanceComplete:input.provenanceComplete,replayDeterministic:input.replayDeterministic,restoreVerified:restore.restoreVerified,queuesStable:queue.queuesStable,p95Verified:latency.p95Verified,p95Ms:latency.p95Ms},{stage:options.stage||'1M',p95LimitMs:options.p95LimitMs||1000});
  const finalScale=evaluateScaleGate({manifest:{canonicalCount:Number(input.canonicalCount||0),logicalDuplicateCount:Number(input.logicalDuplicateCount||0)}},{requiredCanonicalCount:1000000,provenanceComplete:input.provenanceComplete===true,restoreVerified:restore.restoreVerified,replayDeterministic:input.replayDeterministic===true,queuesStable:queue.queuesStable,p95Ms:latency.p95Verified?latency.p95Ms:Number.NaN,p95LimitMs:options.p95LimitMs||1000});
  const snapshot={schema:'MPR_PRODUCTION_READINESS_SNAPSHOT_V1',fleet:legacyFleet,queue,restore,latency,legacyCheckpointRestore:legacyRestore,stage,finalScale,productionReady:finalScale.decision==='SCALE_READY',providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false};
  return{...snapshot,fingerprint:deterministicFingerprint(snapshot)};
}
