import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProductionAttestation,
  createIngestionCheckpoint,
  verifyCheckpointRestore,
  evaluateReadinessRestoreGate,
  evaluateWorkerFleetHealth,
  evaluateReadinessQueueGate,
  evaluateProgressiveScaleStage,
  buildProductionReadinessSnapshot
} from '../production-readiness-harness-v1.js';
import {serializeCheckpointForPersistence,evaluatePersistenceRestoreEvidence} from '../production-persistence-restore-evidence-v1.js';
import {createWorkerTelemetrySnapshot,evaluateWorkerTelemetryEvidence} from '../production-worker-telemetry-evidence-v1.js';

const hash='a'.repeat(64);
const attestation={
  observationMode:'PRODUCTION_OBSERVED',
  environment:'production',
  evidenceRef:'artifact://prod/telemetry-1',
  observedAt:'2026-08-27T10:00:00Z',
  collectorVersion:'worker-telemetry-v1',
  contentSha256:hash
};

function productionRestoreEvidence(checkpoint){
  const persisted=serializeCheckpointForPersistence(checkpoint);
  return evaluatePersistenceRestoreEvidence({
    persistedCheckpoint:checkpoint,
    restoredCheckpoint:checkpoint,
    persistedContentSha256:persisted.contentSha256,
    restoredContentSha256:persisted.contentSha256
  },{attestation:{
    observationMode:'PRODUCTION_OBSERVED',
    environment:'production',
    evidenceRef:'artifact://prod/restore-1',
    observedAt:'2026-08-27T10:00:00Z',
    collectorVersion:'restore-evidence-v1',
    contentSha256:'c'.repeat(64),
    storageKind:'PRODUCTION_OBJECT_STORE',
    storageRef:'object://checkpoint/run-1',
    restoreProcedureVersion:'restore-procedure-v1',
    persistedContentSha256:persisted.contentSha256,
    restoredContentSha256:persisted.contentSha256,
    independentReadBack:true
  }});
}

function productionWorkerTelemetryEvidence(){
  const snapshotInput={
    observedAt:'2026-08-27T10:00:00Z',
    collectorVersion:'worker-telemetry-v1',
    runtimeRef:'runtime://prod/fleet-a',
    workers:[{id:'w1',status:'HEALTHY',heartbeatAt:'2026-08-27T09:59:59Z',processed:1000000,failed:0,queueDepth:0,oldestMessageAgeMs:0}]
  };
  const snapshot=createWorkerTelemetrySnapshot(snapshotInput);
  return evaluateWorkerTelemetryEvidence({snapshot:snapshotInput,attestation:{
    schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',
    observationMode:'PRODUCTION_OBSERVED',
    environment:'production',
    sourceKind:'PRODUCTION_WORKER_RUNTIME',
    evidenceRef:'artifact://prod/worker-telemetry-1',
    observedAt:snapshot.observedAt,
    collectorVersion:snapshot.collectorVersion,
    runtimeRef:snapshot.runtimeRef,
    contentSha256:snapshot.contentSha256
  }});
}

test('production attestation fails closed without evidence metadata',()=>{
  const result=validateProductionAttestation({observationMode:'PRODUCTION_OBSERVED',environment:'production'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('EVIDENCE_REF_REQUIRED'));
  assert.ok(result.errors.includes('CONTENT_SHA256_REQUIRED'));
});

test('checkpoint restore helper still requires matching checkpoint, artifact hash and production attestation',()=>{
  const checkpoint={runId:'run-1',sequence:10,processedCount:1000,canonicalCount:900,cursor:'cursor-10',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const verified=verifyCheckpointRestore(checkpoint,{...checkpoint},{attestation});
  assert.equal(verified.restoreVerified,true);
  const local=verifyCheckpointRestore(checkpoint,{...checkpoint},{attestation:{...attestation,observationMode:'LOCAL_SIMULATION'}});
  assert.equal(local.restoreVerified,false);
});

test('readiness restore gate rejects legacy restore attestation without persistence restore evidence',()=>{
  const gate=evaluateReadinessRestoreGate({});
  assert.equal(gate.restoreVerified,false);
  assert.equal(gate.decision,'HOLD_RESTORE_GATE');
  assert.ok(gate.reasons.includes('PRODUCTION_PERSISTENCE_RESTORE_EVIDENCE_REQUIRED'));
});

test('readiness restore gate accepts only production persistence restore evidence with exact hash binding',()=>{
  const checkpoint={runId:'run-1',sequence:1,processedCount:1000,canonicalCount:1000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const evidence=productionRestoreEvidence(checkpoint);
  const gate=evaluateReadinessRestoreGate({persistenceRestoreEvidence:evidence});
  assert.equal(gate.restoreVerified,true);
  assert.equal(gate.decision,'RESTORE_GATE_READY');
  const tampered=evaluateReadinessRestoreGate({persistenceRestoreEvidence:{...evidence,restoredContentSha256:'d'.repeat(64)}});
  assert.equal(tampered.restoreVerified,false);
  assert.ok(tampered.reasons.includes('RESTORE_HASH_BINDING_REQUIRED'));
});

test('legacy worker fleet helper remains diagnostic only',()=>{
  const workers=[{id:'w1',status:'HEALTHY',heartbeatAgeMs:1000,processed:100,failed:0}];
  const local=evaluateWorkerFleetHealth(workers,{attestation:{...attestation,observationMode:'LOCAL_SIMULATION'}});
  assert.equal(local.allHealthy,true);
  assert.equal(local.queuesStable,false);
  const production=evaluateWorkerFleetHealth(workers,{attestation});
  assert.equal(production.queuesStable,true);
});

test('readiness queue gate rejects legacy worker attestation without telemetry evidence',()=>{
  const gate=evaluateReadinessQueueGate({workerAttestation:attestation,workers:[{id:'w1',status:'HEALTHY',heartbeatAgeMs:1,processed:10,failed:0}]});
  assert.equal(gate.queuesStable,false);
  assert.equal(gate.decision,'HOLD_QUEUE_GATE');
  assert.ok(gate.reasons.includes('PRODUCTION_WORKER_TELEMETRY_EVIDENCE_REQUIRED'));
});

test('readiness queue gate validates production telemetry evidence and exact attestation binding',()=>{
  const evidence=productionWorkerTelemetryEvidence();
  const gate=evaluateReadinessQueueGate({workerTelemetryEvidence:evidence});
  assert.equal(gate.queuesStable,true);
  assert.equal(gate.decision,'QUEUE_GATE_READY');
  const tampered=evaluateReadinessQueueGate({workerTelemetryEvidence:{...evidence,attestation:{...evidence.attestation,contentSha256:'f'.repeat(64)}}});
  assert.equal(tampered.queuesStable,false);
  assert.ok(tampered.reasons.includes('TELEMETRY_HASH_BINDING_MISMATCH'));
});

test('progressive scale stages enforce 10K, 100K and 1M volumes',()=>{
  const base={logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,restoreVerified:true,queuesStable:true,p95Ms:100,latencyAttestation:attestation};
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:9999},{stage:'10K'}).decision,'HOLD_STAGE');
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:10000},{stage:'10K'}).decision,'STAGE_READY');
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:100000},{stage:'100K'}).decision,'STAGE_READY');
  assert.equal(evaluateProgressiveScaleStage({...base,canonicalCount:999999},{stage:'1M'}).decision,'HOLD_STAGE');
});

test('full production readiness remains HOLD without production restore and telemetry evidence',()=>{
  const checkpoint=createIngestionCheckpoint({runId:'run-1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash});
  const snapshot=buildProductionReadinessSnapshot({
    canonicalCount:1000000,
    logicalDuplicateCount:0,
    provenanceComplete:true,
    replayDeterministic:true,
    p95Ms:100,
    latencyAttestation:attestation,
    workerAttestation:attestation,
    restoreAttestation:attestation,
    workers:[{id:'w1',status:'HEALTHY',heartbeatAgeMs:100,processed:1000,failed:0}],
    originalCheckpoint:checkpoint,
    restoredCheckpoint:checkpoint
  },{stage:'1M',p95LimitMs:1000});
  assert.equal(snapshot.legacyCheckpointRestore.restoreVerified,true);
  assert.equal(snapshot.restore.restoreVerified,false);
  assert.equal(snapshot.fleet.queuesStable,true);
  assert.equal(snapshot.queue.queuesStable,false);
  assert.equal(snapshot.productionReady,false);
  assert.equal(snapshot.finalScale.decision,'HOLD_SCALE');
});

test('restore evidence alone cannot bypass worker telemetry gate',()=>{
  const checkpoint={runId:'run-1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const snapshot=buildProductionReadinessSnapshot({
    canonicalCount:1000000,
    logicalDuplicateCount:0,
    provenanceComplete:true,
    replayDeterministic:true,
    p95Ms:100,
    latencyAttestation:attestation,
    workerAttestation:attestation,
    persistenceRestoreEvidence:productionRestoreEvidence(checkpoint),
    workers:[{id:'w1',status:'HEALTHY',heartbeatAgeMs:100,processed:1000000,failed:0}],
    originalCheckpoint:checkpoint,
    restoredCheckpoint:checkpoint
  },{stage:'1M',p95LimitMs:1000});
  assert.equal(snapshot.restore.restoreVerified,true);
  assert.equal(snapshot.queue.queuesStable,false);
  assert.equal(snapshot.productionReady,false);
  assert.equal(snapshot.finalScale.decision,'HOLD_SCALE');
});

test('full production readiness can become SCALE_READY only with restore and worker telemetry evidence',()=>{
  const checkpoint={runId:'run-1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing-1',artifactContentSha256:hash};
  const snapshot=buildProductionReadinessSnapshot({
    canonicalCount:1000000,
    logicalDuplicateCount:0,
    provenanceComplete:true,
    replayDeterministic:true,
    p95Ms:100,
    latencyAttestation:attestation,
    persistenceRestoreEvidence:productionRestoreEvidence(checkpoint),
    workerTelemetryEvidence:productionWorkerTelemetryEvidence(),
    originalCheckpoint:checkpoint,
    restoredCheckpoint:checkpoint
  },{stage:'1M',p95LimitMs:1000});
  assert.equal(snapshot.restore.restoreVerified,true);
  assert.equal(snapshot.queue.queuesStable,true);
  assert.equal(snapshot.productionReady,true);
  assert.equal(snapshot.finalScale.decision,'SCALE_READY');
  assert.equal(snapshot.providerDataSpendEur,0);
  assert.equal(snapshot.paidDataCallsTriggered,0);
  assert.equal(snapshot.purchaseAuthorized,false);
});
