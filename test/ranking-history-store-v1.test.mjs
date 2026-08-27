import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryHistoryStore,
  validateHistoryStoreDescriptor,
  persistRankingHistoryRecord,
  restoreRankingHistoryRecord
} from '../ranking-history-store-v1.js';

const record={manifest:{schema:'MPR_RANKING_SIGNAL_HISTORY_LEDGER_V1',entryCount:1},entries:[{historyKey:'AMAZON:B001|EXPLICIT_PRODUCT_BEST_SELLERS_RANK|CAT',rankValue:42}]};

test('memory history store round trip verifies locally',async()=>{
  const store=createMemoryHistoryStore();
  const receipt=await persistRankingHistoryRecord(store,'ledger',record,{storedAt:'2026-08-27T10:00:00Z'});
  const proof=await restoreRankingHistoryRecord(store,receipt);
  assert.equal(proof.localVerified,true);
  assert.equal(proof.productionVerified,false);
  assert.equal(proof.decision,'LOCAL_RESTORE_VERIFIED');
  assert.deepEqual(proof.record,record);
});

test('tampering is detected by receipt hash and fingerprint',async()=>{
  const store=createMemoryHistoryStore();
  const receipt=await persistRankingHistoryRecord(store,'ledger',record,{storedAt:'2026-08-27T10:00:00Z'});
  const stored=await store.get('ledger');
  stored.record.entries[0].rankValue=999;
  await store.put('ledger',stored);
  const proof=await restoreRankingHistoryRecord(store,receipt);
  assert.equal(proof.localVerified,false);
  assert.equal(proof.productionVerified,false);
  assert.ok(proof.reasons.includes('CONTENT_HASH_MISMATCH'));
  assert.ok(proof.reasons.includes('RECORD_FINGERPRINT_MISMATCH'));
});

test('production descriptor fails closed without reviewed metadata',()=>{
  const result=validateHistoryStoreDescriptor({scope:'PRODUCTION_OBJECT_STORE',environment:'production'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('EVIDENCE_REF_REQUIRED'));
  assert.ok(result.errors.includes('REVIEWED_AT_REQUIRED'));
  assert.ok(result.errors.includes('REVIEWER_REQUIRED'));
});

test('complete reviewed production descriptor is valid',()=>{
  const result=validateHistoryStoreDescriptor({
    scope:'PRODUCTION_OBJECT_STORE',environment:'production',
    evidenceRef:'netlify-blobs://mpr-ranking-history-v1/ledger',
    reviewedAt:'2026-08-27T10:00:00Z',reviewer:'MPR_REVIEW',basis:'DEPLOYED_STORE_REVIEW',collectorVersion:'ranking-history-store-v1'
  });
  assert.equal(result.ok,true);
  assert.equal(result.productionScope,true);
});

test('local store can never be promoted by production metadata',async()=>{
  const store=createMemoryHistoryStore();
  const descriptor={
    scope:'PRODUCTION_OBJECT_STORE',environment:'production',
    evidenceRef:'netlify-blobs://mpr-ranking-history-v1/ledger',
    reviewedAt:'2026-08-27T10:00:00Z',reviewer:'MPR_REVIEW',basis:'DEPLOYED_STORE_REVIEW',collectorVersion:'ranking-history-store-v1'
  };
  const receipt=await persistRankingHistoryRecord(store,'ledger',record,{storedAt:'2026-08-27T10:00:00Z',descriptor});
  const proof=await restoreRankingHistoryRecord(store,receipt,{descriptor});
  assert.equal(proof.localVerified,true);
  assert.equal(proof.productionVerified,false);
  assert.ok(proof.reasons.includes('STORE_SCOPE_MISMATCH'));
});

test('synthetic production-scope adapter verifies only with matching reviewed evidence ref',async()=>{
  const map=new Map();
  const evidenceRef='netlify-blobs://mpr-ranking-history-v1/ledger';
  const store={
    scope:'PRODUCTION_OBJECT_STORE',
    async get(key){return map.get(key)||null;},
    async put(key,value){map.set(key,structuredClone(value));return{key,storageRef:evidenceRef};}
  };
  const descriptor={
    scope:'PRODUCTION_OBJECT_STORE',environment:'production',evidenceRef,
    reviewedAt:'2026-08-27T10:00:00Z',reviewer:'MPR_REVIEW',basis:'DEPLOYED_STORE_REVIEW',collectorVersion:'ranking-history-store-v1'
  };
  const receipt=await persistRankingHistoryRecord(store,'ledger',record,{storedAt:'2026-08-27T10:00:00Z',descriptor});
  const proof=await restoreRankingHistoryRecord(store,receipt,{descriptor});
  assert.equal(proof.productionVerified,true);
  assert.equal(proof.decision,'PRODUCTION_RESTORE_VERIFIED');
});
