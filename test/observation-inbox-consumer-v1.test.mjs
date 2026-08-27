import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryHistoryStore} from '../ranking-history-store-v1.js';
import {createObservationConsumptionReceipt,persistObservationConsumptionReceipt,validateObservationConsumptionReceipt} from '../observation-inbox-consumer-v1.js';

const baseInput={
  inboxFingerprint:'inbox-fingerprint-1',
  sourceFingerprint:'source-fingerprint-1',
  cycleFingerprint:'cycle-fingerprint-1',
  cycleDecision:'COMPLETED',
  handoffFingerprint:'handoff-fingerprint-1'
};

const scheduler={
  executionMode:'PRODUCTION_SCHEDULED',environment:'production',schedulerName:'unit-scheduler',runId:'run-1',triggerRef:'schedule/test',
  scheduledFor:'2026-08-27T10:00:00Z',startedAt:'2026-08-27T10:00:05Z',evidenceRef:'scheduler://run-1',collectorVersion:'scheduler-attestation-v1',contentSha256:'b'.repeat(64)
};

test('local consumption receipt is analysis-only',()=>{
  const receipt=createObservationConsumptionReceipt(baseInput,{completedAt:'2026-08-27T10:05:00Z'});
  assert.equal(receipt.analysisConsumed,true);
  assert.equal(receipt.productionConsumed,false);
  assert.equal(validateObservationConsumptionReceipt(receipt).valid,true);
});

test('production consumption requires both scheduler attestation and production persistence',()=>{
  const noPersistence=createObservationConsumptionReceipt(baseInput,{completedAt:'2026-08-27T10:05:00Z',schedulerAttestation:scheduler,productionPersistenceVerified:false});
  assert.equal(noPersistence.productionConsumed,false);
  const production=createObservationConsumptionReceipt(baseInput,{completedAt:'2026-08-27T10:05:00Z',schedulerAttestation:scheduler,productionPersistenceVerified:true});
  assert.equal(production.productionConsumed,true);
  assert.equal(validateObservationConsumptionReceipt(production).valid,true);
});

test('receipt tampering fails validation',()=>{
  const receipt=createObservationConsumptionReceipt(baseInput,{completedAt:'2026-08-27T10:05:00Z'});
  const tampered={...receipt,sourceFingerprint:'changed'};
  const validation=validateObservationConsumptionReceipt(tampered);
  assert.equal(validation.valid,false);
  assert.ok(validation.reasons.includes('RECEIPT_FINGERPRINT_MISMATCH'));
});

test('consumption persistence is idempotent for same receipt',async()=>{
  const store=createMemoryHistoryStore();
  const receipt=createObservationConsumptionReceipt(baseInput,{completedAt:'2026-08-27T10:05:00Z'});
  const first=await persistObservationConsumptionReceipt(store,receipt);
  const second=await persistObservationConsumptionReceipt(store,receipt);
  assert.equal(first.decision,'RECORDED');
  assert.equal(second.decision,'ALREADY_RECORDED');
  assert.equal(second.idempotent,true);
});

test('different receipt for same inbox conflicts instead of overwriting',async()=>{
  const store=createMemoryHistoryStore();
  const first=createObservationConsumptionReceipt(baseInput,{completedAt:'2026-08-27T10:05:00Z'});
  const second=createObservationConsumptionReceipt({...baseInput,cycleFingerprint:'cycle-fingerprint-2'},{completedAt:'2026-08-27T10:06:00Z'});
  await persistObservationConsumptionReceipt(store,first);
  const result=await persistObservationConsumptionReceipt(store,second);
  assert.equal(result.decision,'CONFLICT');
  assert.equal(result.persisted,false);
  assert.equal(result.idempotent,false);
});

test('incomplete cycle cannot be marked consumed',()=>{
  const receipt=createObservationConsumptionReceipt({...baseInput,cycleDecision:'WAIT'},{completedAt:'2026-08-27T10:05:00Z'});
  assert.equal(receipt.analysisConsumed,false);
  assert.ok(receipt.reasons.includes('HISTORY_CYCLE_NOT_COMPLETED'));
});
