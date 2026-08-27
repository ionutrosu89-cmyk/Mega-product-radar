import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryHistoryStore} from '../ranking-history-store-v1.js';
import {createObservationInboxEnvelope,enqueueObservationBundle,readObservationInboxEntry,validateObservationInboxEnvelope,validateSchedulerAttestation} from '../live-observation-inbox-v1.js';

const bundle={
  manifest:{schema:'MPR_RANKING_SIGNAL_RESOLVED_BUNDLE_V1',fingerprint:'bundle-fingerprint-1',asOf:'2026-08-27T10:00:00Z'},
  trustedRecords:[],heldRecords:[]
};

test('inbox envelope is deterministic and validates while fresh',()=>{
  const a=createObservationInboxEnvelope(bundle,{receivedAt:'2026-08-27T10:00:00Z',sourceRef:'fixture'});
  const b=createObservationInboxEnvelope(bundle,{receivedAt:'2026-08-27T10:00:00Z',sourceRef:'fixture'});
  assert.equal(a.fingerprint,b.fingerprint);
  const result=validateObservationInboxEnvelope(a,{now:'2026-08-27T10:30:00Z'});
  assert.equal(result.valid,true);
});

test('inbox rejects tampering and stale entries',()=>{
  const envelope=createObservationInboxEnvelope(bundle,{receivedAt:'2026-08-27T10:00:00Z'});
  const tampered={...envelope,sourceFingerprint:'tampered'};
  assert.equal(validateObservationInboxEnvelope(tampered,{now:'2026-08-27T10:30:00Z'}).valid,false);
  const stale=validateObservationInboxEnvelope(envelope,{now:'2026-08-27T13:00:01Z',maxAgeMs:2*60*60*1000});
  assert.equal(stale.valid,false);
  assert.ok(stale.reasons.includes('INBOX_ENTRY_STALE'));
});

test('enqueue is idempotent for identical bundle',async()=>{
  const store=createMemoryHistoryStore();
  const first=await enqueueObservationBundle(store,bundle,{receivedAt:'2026-08-27T10:00:00Z'});
  const second=await enqueueObservationBundle(store,bundle,{receivedAt:'2026-08-27T10:00:00Z'});
  assert.equal(first.decision,'ENQUEUED');
  assert.equal(second.decision,'ALREADY_ENQUEUED');
  assert.equal(second.idempotent,true);
});

test('scheduler attestation fails closed when production evidence is incomplete',()=>{
  const result=validateSchedulerAttestation({executionMode:'PRODUCTION_SCHEDULED',environment:'production'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('RUN_ID_REQUIRED'));
  assert.ok(result.errors.includes('CONTENT_SHA256_REQUIRED'));
});

test('complete production scheduler attestation can establish production runnable state',async()=>{
  const store=createMemoryHistoryStore();
  const queued=await enqueueObservationBundle(store,bundle,{receivedAt:'2026-08-27T10:00:00Z'});
  const attestation={
    executionMode:'PRODUCTION_SCHEDULED',environment:'production',schedulerName:'unit-scheduler',runId:'run-1',triggerRef:'schedule/test',
    scheduledFor:'2026-08-27T10:30:00Z',startedAt:'2026-08-27T10:30:05Z',evidenceRef:'scheduler://run-1',collectorVersion:'scheduler-attestation-v1',contentSha256:'a'.repeat(64)
  };
  const read=await readObservationInboxEntry(store,queued.key,{now:'2026-08-27T10:30:05Z',schedulerAttestation:attestation});
  assert.equal(read.analysisRunnable,true);
  assert.equal(read.productionRunnable,true);
});

test('local read without scheduler attestation can never become production runnable',async()=>{
  const store=createMemoryHistoryStore();
  const queued=await enqueueObservationBundle(store,bundle,{receivedAt:'2026-08-27T10:00:00Z'});
  const read=await readObservationInboxEntry(store,queued.key,{now:'2026-08-27T10:30:00Z'});
  assert.equal(read.analysisRunnable,true);
  assert.equal(read.productionRunnable,false);
});
