import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLatencyEvidence} from '../production-latency-evidence-v1.js';
import {evaluateWorkerTelemetryEvidence} from '../production-worker-telemetry-evidence-v1.js';
import {evaluatePersistenceRestoreEvidence,serializeCheckpointForPersistence} from '../production-persistence-restore-evidence-v1.js';
import {buildProductionReadinessSnapshot} from '../production-readiness-harness-v1.js';
import {createProductionEvidenceBundle,validateProductionEvidenceBundle,evaluateProgressiveProductionScale} from '../production-evidence-bundle-v1.js';

const observedAt='2026-08-27T10:00:00Z';
const inventory=count=>({schema:'MPR_CANONICAL_INVENTORY_EVIDENCE_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',inventoryClass:'REAL_CANONICAL_PRODUCTS',evidenceRef:'artifact://prod/inventory',observedAt,collectorVersion:'inventory-v1',contentSha256:'a'.repeat(64),canonicalCount:count,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true});

function latency(){
  const snapshot={observedAt,collectorVersion:'latency-v1',runtimeRef:'prod://runtime/a',operation:'INGEST',surface:'PIPELINE',samplesMs:Array.from({length:100},(_,i)=>50+i)};
  const first=evaluateLatencyEvidence({snapshot},{p95LimitMs:1000,minSampleCount:100});
  return evaluateLatencyEvidence({snapshot,attestation:{schema:'MPR_LATENCY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',sourceKind:'PRODUCTION_PIPELINE_RUNTIME',evidenceRef:'artifact://prod/latency',observedAt,collectorVersion:'latency-v1',runtimeRef:'prod://runtime/a',operation:'INGEST',surface:'PIPELINE',contentSha256:first.snapshot.contentSha256}},{p95LimitMs:1000,minSampleCount:100});
}

function workers(){
  const snapshot={observedAt,collectorVersion:'worker-v1',runtimeRef:'prod://runtime/a',workers:[{id:'w1',status:'HEALTHY',heartbeatAt:'2026-08-27T09:59:59Z',processed:1000,failed:0,queueDepth:0,oldestMessageAgeMs:0}]};
  const first=evaluateWorkerTelemetryEvidence({snapshot});
  return evaluateWorkerTelemetryEvidence({snapshot,attestation:{schema:'MPR_WORKER_TELEMETRY_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',sourceKind:'PRODUCTION_WORKER_RUNTIME',evidenceRef:'artifact://prod/workers',observedAt,collectorVersion:'worker-v1',runtimeRef:'prod://runtime/a',contentSha256:first.snapshot.contentSha256}});
}

function restore(){
  const checkpoint={runId:'r1',sequence:1,processedCount:1000000,canonicalCount:1000000,cursor:'end',ingestionFingerprint:'ing',artifactContentSha256:'b'.repeat(64)};
  const serialized=serializeCheckpointForPersistence(checkpoint);
  return evaluatePersistenceRestoreEvidence({persistedCheckpoint:checkpoint,restoredCheckpoint:checkpoint,persistedContentSha256:serialized.contentSha256,restoredContentSha256:serialized.contentSha256},{attestation:{observationMode:'PRODUCTION_OBSERVED',environment:'production',evidenceRef:'artifact://prod/restore',observedAt,collectorVersion:'restore-v1',contentSha256:'c'.repeat(64),storageKind:'PRODUCTION_OBJECT_STORE',storageRef:'object://prod/checkpoint',restoreProcedureVersion:'restore-v1',persistedContentSha256:serialized.contentSha256,restoredContentSha256:serialized.contentSha256,independentReadBack:true}});
}

test('readiness rejects declared p95 without latency evidence',()=>{
  const snapshot=buildProductionReadinessSnapshot({canonicalCount:1000000,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,p95Ms:100,persistenceRestoreEvidence:restore(),workerTelemetryEvidence:workers()},{stage:'1M'});
  assert.equal(snapshot.latency.p95Verified,false);
  assert.equal(snapshot.productionReady,false);
});

test('tampered latency evidence cannot satisfy readiness',()=>{
  const evidence=latency();
  const snapshot=buildProductionReadinessSnapshot({canonicalCount:1000000,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:true,persistenceRestoreEvidence:restore(),workerTelemetryEvidence:workers(),latencyEvidence:{...evidence,p95Ms:1}},{stage:'1M'});
  assert.equal(snapshot.latency.p95Verified,false);
  assert.equal(snapshot.productionReady,false);
});

test('bundle rejects synthetic inventory as real production scale evidence',()=>{
  const bundle=createProductionEvidenceBundle({bundleRef:'bundle://1',createdAt:observedAt,canonicalInventoryEvidence:{...inventory(1000000),inventoryClass:'SYNTHETIC_SCALE_BENCHMARK'},persistenceRestoreEvidence:restore(),workerTelemetryEvidence:workers(),latencyEvidence:latency()});
  const validation=validateProductionEvidenceBundle(bundle);
  assert.equal(validation.ok,false);
  assert.ok(validation.errors.includes('REAL_CANONICAL_PRODUCT_INVENTORY_REQUIRED'));
});

test('progressive stages require real canonical counts at each gate',()=>{
  const bundle=createProductionEvidenceBundle({bundleRef:'bundle://2',createdAt:observedAt,canonicalInventoryEvidence:inventory(100000),persistenceRestoreEvidence:restore(),workerTelemetryEvidence:workers(),latencyEvidence:latency()});
  const result=evaluateProgressiveProductionScale(bundle);
  assert.equal(result.stages[0].stageAuthorized,true);
  assert.equal(result.stages[1].stageAuthorized,true);
  assert.equal(result.stages[2].stageAuthorized,false);
  assert.equal(result.decision,'HOLD_PROGRESSIVE_SCALE');
});

test('full synthetic unit evidence path can satisfy all gates only with real inventory class and 1M count',()=>{
  const bundle=createProductionEvidenceBundle({bundleRef:'bundle://3',createdAt:observedAt,canonicalInventoryEvidence:inventory(1000000),persistenceRestoreEvidence:restore(),workerTelemetryEvidence:workers(),latencyEvidence:latency()});
  const validation=validateProductionEvidenceBundle(bundle);
  const result=evaluateProgressiveProductionScale(bundle);
  assert.equal(validation.ok,true);
  assert.equal(result.stages.every(x=>x.stageAuthorized),true);
  assert.equal(result.providerDataSpendEur,0);
  assert.equal(result.paidDataCallsTriggered,0);
  assert.equal(result.purchaseAuthorized,false);
});
