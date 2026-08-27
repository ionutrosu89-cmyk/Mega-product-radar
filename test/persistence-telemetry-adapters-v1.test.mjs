import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeCheckpointEnvelope,
  verifyPersistedCheckpoint,
  normalizeWorkerHeartbeat,
  evaluateTelemetrySnapshot,
  buildProgressiveCapacityPlan,
  createSyntheticCapacityCheckpoint,
  validateExternalEvidenceRecord
} from '../persistence-telemetry-adapters-v1.js';

const productionAttestation=evidenceRef=>({
  observationMode:'PRODUCTION_OBSERVED',
  environment:'production',
  evidenceRef,
  observedAt:'2026-08-27T10:00:00.000Z',
  collectorVersion:'worker-telemetry-v1',
  contentSha256:'a'.repeat(64)
});

test('local checkpoint roundtrip does not prove production persistence',()=>{
  const checkpoint=createSyntheticCapacityCheckpoint({targetCanonicalCount:10000,processedCount:10000,sequence:1});
  const options={storageMode:'LOCAL_FILE',storageRef:'artifacts/checkpoint.json',writtenAt:'2026-08-27T10:00:00.000Z'};
  const persisted=serializeCheckpointEnvelope(checkpoint,options);
  assert.match(persisted.contentSha256,/^[a-f0-9]{64}$/);
  const verification=verifyPersistedCheckpoint(checkpoint,structuredClone(checkpoint),{
    original:options,
    restored:options,
    attestation:productionAttestation('storage://checkpoint/1')
  });
  assert.equal(verification.stateMatch,true);
  assert.equal(verification.contentHashMatch,true);
  assert.equal(verification.productionStorage,false);
  assert.equal(verification.productionPersistenceVerified,false);
});

test('production persistence requires matching state, production storage and valid attestation',()=>{
  const checkpoint=createSyntheticCapacityCheckpoint({targetCanonicalCount:10000,processedCount:10000,sequence:1});
  const options={storageMode:'PRODUCTION_PERSISTENCE',storageRef:'blob://mpr/checkpoint/1',writtenAt:'2026-08-27T10:00:00.000Z'};
  const verification=verifyPersistedCheckpoint(checkpoint,structuredClone(checkpoint),{
    original:options,
    restored:options,
    attestation:productionAttestation('blob://mpr/checkpoint/1')
  });
  assert.equal(verification.productionPersistenceVerified,true);
  assert.equal(verification.decision,'PERSISTENCE_VERIFIED');
});

test('worker heartbeat age is deterministic from snapshotAt',()=>{
  const heartbeat=normalizeWorkerHeartbeat({
    workerId:'worker-a',status:'HEALTHY',observedAt:'2026-08-27T09:59:30.000Z',processed:99,failed:1
  },{snapshotAt:'2026-08-27T10:00:00.000Z'});
  assert.equal(heartbeat.heartbeatAgeMs,30000);
  assert.equal(heartbeat.failureRate,0.01);
});

test('local healthy telemetry cannot prove production stability',()=>{
  const snapshot=evaluateTelemetrySnapshot([{
    workerId:'worker-a',status:'HEALTHY',observedAt:'2026-08-27T09:59:50.000Z',processed:1000,failed:0,queueDepth:2,oldestQueueAgeMs:500
  }],{
    snapshotAt:'2026-08-27T10:00:00.000Z',
    attestation:{observationMode:'LOCAL_SIMULATION',environment:'local'}
  });
  assert.equal(snapshot.locallyHealthy,true);
  assert.equal(snapshot.productionStable,false);
  assert.equal(snapshot.decision,'PRODUCTION_TELEMETRY_NOT_PROVEN');
});

test('production telemetry can become stable only with valid attestation and healthy workers',()=>{
  const snapshot=evaluateTelemetrySnapshot([{
    workerId:'worker-a',status:'HEALTHY',observedAt:'2026-08-27T09:59:50.000Z',processed:1000,failed:0,queueDepth:2,oldestQueueAgeMs:500
  }],{
    snapshotAt:'2026-08-27T10:00:00.000Z',
    attestation:productionAttestation('telemetry://snapshot/1')
  });
  assert.equal(snapshot.productionStable,true);
});

test('progressive capacity plan is explicit that synthetic stages are not production evidence',()=>{
  const plan=buildProgressiveCapacityPlan({chunkSize:5000});
  assert.deepEqual(plan.map(x=>x.targetCanonicalCount),[10000,100000,1000000]);
  assert.equal(plan.every(x=>x.productionEvidence===false),true);
  assert.equal(plan[2].estimatedChunks,200);
});

test('synthetic capacity checkpoint is deterministic',()=>{
  const a=createSyntheticCapacityCheckpoint({targetCanonicalCount:100000,processedCount:50000,sequence:5,seed:'x'});
  const b=createSyntheticCapacityCheckpoint({targetCanonicalCount:100000,processedCount:50000,sequence:5,seed:'x'});
  assert.equal(a.checkpointFingerprint,b.checkpointFingerprint);
  assert.equal(a.canonicalCount,50000);
});

test('external evidence requires production attestation and matching evidence reference',()=>{
  const valid=validateExternalEvidenceRecord({
    evidenceType:'QUEUE_TELEMETRY',
    evidenceRef:'telemetry://snapshot/1',
    contentSha256:'b'.repeat(64),
    attestation:productionAttestation('telemetry://snapshot/1')
  });
  assert.equal(valid.ok,true);
  const bad=validateExternalEvidenceRecord({
    evidenceType:'QUEUE_TELEMETRY',
    evidenceRef:'telemetry://snapshot/2',
    contentSha256:'b'.repeat(64),
    attestation:productionAttestation('telemetry://snapshot/1')
  });
  assert.equal(bad.ok,false);
  assert.ok(bad.errors.includes('EVIDENCE_REF_MISMATCH'));
});
