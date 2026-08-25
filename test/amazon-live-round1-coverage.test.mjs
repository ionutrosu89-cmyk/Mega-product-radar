import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const first=JSON.parse(fs.readFileSync(new URL('../data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',import.meta.url),'utf8'));
const remaining=JSON.parse(fs.readFileSync(new URL('../data/live-snapshots/amazon-round1-remaining.compact.json',import.meta.url),'utf8'));

const firstIds=first.snapshots.map(r=>r[0]);
const remainingIds=remaining.products.map(r=>r[0]);
const allIds=[...firstIds,...remainingIds];

test('round1 persisted live coverage is deterministic and duplicate-free',()=>{
  assert.equal(first.validObservations,90);
  assert.equal(remaining.uniqueLiveSnapshots,64);
  assert.equal(allIds.length,154);
  assert.equal(new Set(allIds).size,154);
});

test('persisted live data stays non-sales and non-trend-authoritative',()=>{
  assert.equal(first.policy.providerSpendEur,0);
  assert.equal(first.policy.paidCallsTriggered,0);
  assert.equal(first.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(first.policy.purchaseAuthorized,false);
  assert.equal(remaining.policy.providerSpendEur,0);
  assert.equal(remaining.policy.paidCallsTriggered,0);
  assert.equal(remaining.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(remaining.policy.purchaseAuthorized,false);
  assert.equal(remaining.policy.trendAuthorized,false);
  assert.equal(remaining.policy.minObservationHoursBeforeTrend,24);
});

test('remaining parallel attempt is preserved as partial evidence, not overstated coverage',()=>{
  assert.equal(remaining.scope.requested,900);
  assert.equal(remaining.uniqueLiveSnapshots,64);
  assert.ok(remaining.uniqueLiveSnapshots<remaining.scope.requested);
  assert.equal(remaining.batchSummary.length,9);
  assert.ok(remaining.batchSummary.every(x=>x.blocked===0));
});
