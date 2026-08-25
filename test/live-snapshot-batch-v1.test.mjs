import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadLiveSnapshotBatch,liveSnapshotBatchHistoryStatus} from '../live-snapshot-batch.js';

const compact=JSON.parse(fs.readFileSync(new URL('../data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',import.meta.url),'utf8'));

test('persisted live batch validates with 90 unique live observations',()=>{
  const x=loadLiveSnapshotBatch(compact);
  assert.equal(x.ok,true);assert.deepEqual(x.errors,[]);assert.equal(x.validObservations,90);
  assert.equal(new Set(x.snapshots.map(s=>s.externalId)).size,90);
  assert.ok(x.snapshots.every(s=>s.liveEvidence===true&&s.salesEvidenceClass==='NOT_VERIFIED_SALES'&&s.purchaseAuthorized===false));
  assert.equal(x.coverage.withPrice,89);assert.equal(x.coverage.withRating,90);assert.equal(x.coverage.withReviews,90);
});

test('first live batch alone cannot create trend velocity',()=>{
  const x=liveSnapshotBatchHistoryStatus(compact);
  assert.equal(x.ok,true);assert.equal(x.validObservations,90);assert.equal(x.trendReadyCount,0);assert.equal(x.allRemainInsufficientFreshHistory,true);
});

test('snapshot hash fails closed after data mutation',()=>{
  const clone=structuredClone(compact);clone.snapshots[0][1]=999999;
  const x=loadLiveSnapshotBatch(clone);assert.equal(x.ok,false);assert.ok(x.errors.includes('SNAPSHOT_HASH_MISMATCH'));
});
