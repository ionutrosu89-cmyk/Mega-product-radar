import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeCheckpointForPersistence,validatePersistenceRestoreAttestation,evaluatePersistenceRestoreEvidence} from '../production-persistence-restore-evidence-v1.js';

const checkpoint={
  runId:'run-1',sequence:7,processedCount:1000,canonicalCount:1000,cursor:'cursor-7',
  ingestionFingerprint:'ingest-fp',artifactContentSha256:'b'.repeat(64)
};

function productionAttestation(hash){
  return{
    observationMode:'PRODUCTION_OBSERVED',environment:'production',evidenceRef:'artifact://restore/1',observedAt:'2026-08-27T13:00:00Z',collectorVersion:'restore-evidence-v1',contentSha256:'c'.repeat(64),
    storageKind:'PRODUCTION_OBJECT_STORE',storageRef:'object://checkpoint/run-1',restoreProcedureVersion:'restore-procedure-v1',
    persistedContentSha256:hash,restoredContentSha256:hash,independentReadBack:true
  };
}

test('checkpoint serialization is deterministic',()=>{
  const a=serializeCheckpointForPersistence(checkpoint);
  const b=serializeCheckpointForPersistence({...checkpoint});
  assert.equal(a.contentSha256,b.contentSha256);
  assert.equal(a.checkpointFingerprint,b.checkpointFingerprint);
});

test('local exact restore verifies locally but not as production evidence',()=>{
  const persisted=serializeCheckpointForPersistence(checkpoint);
  const result=evaluatePersistenceRestoreEvidence({
    persistedCheckpoint:checkpoint,restoredCheckpoint:checkpoint,
    persistedContentSha256:persisted.contentSha256,restoredContentSha256:persisted.contentSha256
  },{attestation:{}});
  assert.equal(result.localRestoreVerified,true);
  assert.equal(result.productionRestoreVerified,false);
  assert.equal(result.decision,'HOLD_PRODUCTION_RESTORE');
  assert.ok(result.reasons.includes('PRODUCTION_OBSERVATION_REQUIRED'));
});

test('tampered restored checkpoint fails hash and fingerprint checks',()=>{
  const persisted=serializeCheckpointForPersistence(checkpoint);
  const restored={...checkpoint,canonicalCount:999};
  const restoredSerialized=serializeCheckpointForPersistence(restored);
  const result=evaluatePersistenceRestoreEvidence({
    persistedCheckpoint:checkpoint,restoredCheckpoint:restored,
    persistedContentSha256:persisted.contentSha256,restoredContentSha256:restoredSerialized.contentSha256
  },{attestation:{}});
  assert.equal(result.localRestoreVerified,false);
  assert.equal(result.checkpointMatch,false);
  assert.equal(result.contentHashMatch,false);
});

test('production attestation requires storage metadata and independent read-back',()=>{
  const hash=serializeCheckpointForPersistence(checkpoint).contentSha256;
  const validation=validatePersistenceRestoreAttestation({...productionAttestation(hash),storageRef:'',independentReadBack:false});
  assert.equal(validation.valid,false);
  assert.ok(validation.errors.includes('STORAGE_REF_REQUIRED'));
  assert.ok(validation.errors.includes('INDEPENDENT_READ_BACK_REQUIRED'));
});

test('attestation hashes must bind to observed persisted and restored bytes',()=>{
  const persisted=serializeCheckpointForPersistence(checkpoint);
  const result=evaluatePersistenceRestoreEvidence({
    persistedCheckpoint:checkpoint,restoredCheckpoint:checkpoint,
    persistedContentSha256:persisted.contentSha256,restoredContentSha256:persisted.contentSha256
  },{attestation:productionAttestation('d'.repeat(64))});
  assert.equal(result.localRestoreVerified,true);
  assert.equal(result.productionRestoreVerified,false);
  assert.ok(result.reasons.includes('ATTESTATION_HASH_BINDING_FAILED'));
});

test('synthetic complete production-evidence path can verify restore contract',()=>{
  const persisted=serializeCheckpointForPersistence(checkpoint);
  const result=evaluatePersistenceRestoreEvidence({
    persistedCheckpoint:checkpoint,restoredCheckpoint:checkpoint,
    persistedContentSha256:persisted.contentSha256,restoredContentSha256:persisted.contentSha256
  },{attestation:productionAttestation(persisted.contentSha256)});
  assert.equal(result.localRestoreVerified,true);
  assert.equal(result.productionRestoreVerified,true);
  assert.equal(result.decision,'PRODUCTION_RESTORE_VERIFIED');
  assert.equal(result.providerDataSpendEur,0);
  assert.equal(result.paidDataCallsTriggered,0);
  assert.equal(result.purchaseAuthorized,false);
  assert.equal(result.verifiedSalesRows,0);
  assert.equal(result.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
