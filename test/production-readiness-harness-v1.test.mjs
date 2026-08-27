import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProductionAttestation,
  createIngestionCheckpoint,
  verifyCheckpointRestore,
  evaluateReadinessRestoreGate,
  evaluateWorkerFleetHealth,
  evaluateReadinessQueueGate,
  evaluateReadinessLatencyGate,
  evaluateProgressiveScaleStage,
  buildProductionReadinessSnapshot
} from '../production-readiness-harness-v1.js';
import {serializeCheckpointForPersistence,evaluatePersistenceRestoreEvidence} from '../production-persistence-restore-evidence-v1.js';
import {createWorkerTelemetrySnapshot,evaluateWorkerTelemetryEvidence} from '../production-worker-telemetry-evidence-v1.js';
import {createLatencySnapshot,evaluateLatencyEvidence} from '../production-latency-evidence-v1.js';

const hash='a'.repeat(64);
const attestation={observationMode:'PRODUCTION_OBSERVED',environment:'production',evidenceRef:'artifact://prod/telemetry-1',observedAt:'2026-08-27T10:00:00Z',collectorVersion:'worker-telemetry-v1',contentSha256:hash};

function productionRestoreEvidence(checkpoint){
  const persisted=serializeCheckpointForPersistence(checkpoint);
  return evaluatePersistenceRestoreEvidence({persistedCheckpoint:checkpoint,restoredCheckpoint:checkpoint,persistedContentSha256:persisted.contentSha256,restoredContentSha256:persisted.contentSha256},{attestation:{observationMode:'PRODUCTION_OBSERVED',environment:'production',evidenceRef:'artifact://prod/restore-1',observedAt:'2026-08-27T10:00:00Z',collectorVersion:'restore-evidence-v1',contentSha256:'c'.repeat(64),storageKind:'PRODUCTION_OBJECT_STORE',storageRef:'object://checkpoint/run-1',restoreProcedureVersion:'restore-procedure-v1',persistedContentSha256:persisted.contentSha256,restoredContentSha256:persisted.contentSha256,independentReadBack:true}});
}

function productionWorkerTelemetryEvidence(){
  const snapshotInput={observedAt:'2026-08-27T10:00:00Z',collectorVersion:'worker-telemetry-v1',runtimeRef:'runtime://prod/fleet-a',workers:[{id:'w1',status:'HEALTHY',heartbeatAt:'2026-08-27T09:59:59Z',processed:1000000,failed:0,queueDepth:0,oldestMessageAgeMs:0}]};
  const snapshot=createWorkerTelemetrySnapshot(snapshotInput);
  return evaluateWorkerTelemetryEvidence({snapshot:snapshotInput,attestation:{schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',sourceKind:'PRODUCTION_WORKER_RUNTIME',evidenceRef:'artifact://prod/worker-telemetry-1',observedAt:snapshot.observedAt,collectorVersion:snapshot.collectorVersion,runtimeRef:snapshot.runtimeRef,contentSha256:snapshot.contentSha256}});
}

function productionLatencyEvidence(){
  const snapshotInput={observedAt:'2026-08-27T10:00:00Z',collectorVersion:'latency-v1',runtimeRef:'runtime://prod/fleet-a',operation:'INGEST',surface:'PIPELINE',samplesMs:Array.from({length:100},(_,i)=>50+i)};
  const snapshot=createLatencySnapshot(snapshotInput);
  return evaluateLatencyEvidence({snapshot:snapshotInput,attestation:{schema:'MPR_LATENCY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',sourceKind:'PRODUCTION_PIPELINE_RUNTIME',evidenceRef:'artifact://prod/latency-1',observedAt:snapshot.observedAt,collectorVersion:snapshot.collectorVersion,runtimeRef:snapshot.runtimeRef,operation:snapshot.operation,surface:snapshot.surface,contentSha256:snapshot.contentSha256}},{p95LimitMs:1000,minSampleCount:100});
}

test('production attestation fails closed without evidence metadata',()=>{
  const result=validateProductionAttestation({observationMode:'PRODUCTION_OBSERVED',environment:'production'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('EVIDENCE_REF_REQUIRED'));
  assert.ok(result.errors.includes('CONTENT_SHA256_REQUIRED'));
});

test('checkpoint restore helper still requires matching checkpoint, artifact hash and production attestation',()=>{
  const checkpoint={runId:'run-1',sequence:10,processedCount:1000,canonicalCount:900,cursor:'cursor-10',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  assert.equal(verifyCheckpointRestore(checkpoint,{...checkpoint},{attestation}).restoreVerified,true);
  assert.equal(verifyCheckpointRestore(checkpoint,{...checkpoint},{attestation:{...attestation,observationMode:'LOCAL_SIMULATION'}}).restoreVerified,false);
});

test('readiness restore gate rejects legacy restore attestation without persistence restore evidence',()=>{
  const gate=evaluateReadinessRestoreGate({});
  assert.equal(gate.restoreVerified,false);
  assert.ok(gate.reasons.includes('PRODUCTION_PERSISTENCE_RESTORE_EVIDENCE_REQUIRED'));
});

test('readiness restore gate accepts only production persistence restore evidence with exact hash binding',()=>{
  const checkpoint={runId:'run-1',sequence:1,processedCount:1000,canonicalCount:1000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const evidence=productionRestoreEvidence(checkpoint);
  assert.equal(evaluateReadinessRestoreGate({persistenceRestoreEvidence:evidence}).restoreVerified,true);
  const tampered=evaluateReadinessRestoreGate({persistenceRestoreEvidence:{...evidence,restoredContentSha256:'d'.repeat(64)}});
  assert.equal(tampered.restoreVerified,false);
});

test('legacy worker fleet helper remains diagnostic only',()=>{
  const workers=[{id:'w1',status:'HEALTHY',heartbeatAgeMs:1000,processed:100,failed:0}];
  assert.equal(evaluateWorkerFleetHealth(workers,{attestation:{...attestation,observationMode:'LOCAL_SIMULATION'}}).queuesStable,false);
  assert.equal(evaluateWorkerFleetHealth(workers,{attestation}).queuesStable,true);
});

test('readiness queue gate rejects legacy worker attestation without telemetry evidence',()=>{
  const gate=evaluateReadinessQueueGate({workerAttestation:attestation,workers:[{id:'w1',status:'HEALTHY',heartbeatAgeMs:1,processed:10,failed:0}]});
  assert.equal(gate.queuesStable,false);
  assert.ok(gate.reasons.includes('PRODUCTION_WORKER_TELEMETRY_EVIDENCE_REQUIRED'));
});

test('readiness queue gate validates production telemetry evidence and exact attestation binding',()=>{
  const evidence=productionWorkerTelemetryEvidence();
  const gate=evaluateReadinessQueueGate({workerTelemetryEvidence:evidence});
  assert.equal(gate.queuesStable,true);
  const tampered=evaluateReadinessQueueGate({workerTelemetryEvidence:{...evidence,attestation:{...evidence.attestation,contentSha256:'f'.repeat(64)}}});
  assert.equal(tampered.queuesStable,false);
});

test('readiness latency gate rejects declared scalar and accepts exact production latency evidence',()=>{
  assert.equal(evaluateReadinessLatencyGate({p95Ms:100,latencyAttestation:attestation}).p95Verified,false);
  const evidence=productionLatencyEvidence();
  const gate=evaluateReadinessLatencyGate({latencyEvidence:evidence},{p95LimitMs:1000});
  assert.equal(gate.p95Verified,true);
  assert.equal(gate.p95Ms,evidence.p95Ms);
  const tampered=evaluateReadinessLatencyGate({latencyEvidence:{...evidence,p95Ms:1}},{p95LimitMs:1000});
  assert.equal(tampered.p95Verified,false);
});

test('progressive scale stages enforce 10K, 100K and 1M volumes',()=>{
  const base={logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,restoreVerified:true,queuesStable:true,p95Verified:true,p95Ms:100};
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:9999},{stage:'10K'}).decision,'HOLD_STAGE');
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:10000},{stage:'10K'}).decision,'STAGE_READY');
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:100000},{stage:'100K'}).decision,'STAGE_READY');
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:999999},{stage:'1M'}).decision,'HOLD_STAGE');
});

test('full production readiness remains HOLD without explicit restore queue and latency evidence',()=>{
  const checkpoint=createIngestionCheckpoint({runId:'run-1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash});
  const snapshot=buildProductionReadinessSnapshot({canonicalCount:1000000,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,p95Ms:100,latencyAttestation:attestation,workerAttestation:attestation,restoreAttestation:attestation,workers:[{id:'w1',status:'HEALTHY',heartbeatAgeMs:100,processed:1000,failed:0}],originalCheckpoint:checkpoint,restoredCheckpoint:checkpoint},{stage:'1M',p95LimitMs:1000});
  assert.equal(snapshot.restore.restoreVerified,false);
  assert.equal(snapshot.queue.queuesStable,false);
  assert.equal(snapshot.latency.p95Verified,false);
  assert.equal(snapshot.productionReady,false);
});

test('restore and queue evidence cannot bypass missing latency evidence',()=>{
  const checkpoint={runId:'run-1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const snapshot=buildProductionReadinessSnapshot({canonicalCount:1000000,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,persistenceRestoreEvidence:productionRestoreEvidence(checkpoint),workerTelemetryEvidence:productionWorkerTelemetryEvidence(),p95Ms:100,latencyAttestation:attestation,originalCheckpoint:checkpoint,restoredCheckpoint:checkpoint},{stage:'1M',p95LimitMs:1000});
  assert.equal(snapshot.restore.restoreVerified,true);
  assert.equal(snapshot.queue.queuesStable,true);
  assert.equal(snapshot.latency.p95Verified,false);
  assert.equal(snapshot.productionReady,false);
});

test('full production readiness can become SCALE_READY only with all explicit production evidence',()=>{
  const checkpoint={runId:'run-1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const snapshot=buildProductionReadinessSnapshot({canonicalCount:1000000,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,persistenceRestoreEvidence:productionRestoreEvidence(checkpoint),workerTelemetryEvidence:productionWorkerTelemetryEvidence(),latencyEvidence:productionLatencyEvidence(),originalCheckpoint:checkpoint,restoredCheckpoint:checkpoint},{stage:'1M',p95LimitMs:1000});
  assert.equal(snapshot.restore.restoreVerified,true);
  assert.equal(snapshot.queue.queuesStable,true);
  assert.equal(snapshot.latency.p95Verified,true);
  assert.equal(snapshot.productionReady,true);
  assert.equal(snapshot.finalScale.decision,'SCALE_READY');
  assert.equal(snapshot.providerDataSpendEur,0);
  assert.equal(snapshot.paidDataCallsTriggered,0);
  assert.equal(snapshot.purchaseAuthorized,false);
});
