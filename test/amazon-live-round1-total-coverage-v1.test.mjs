import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const first=JSON.parse(fs.readFileSync(new URL('../data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',import.meta.url),'utf8'));
const partial=JSON.parse(fs.readFileSync(new URL('../data/live-snapshots/amazon-round1-remaining.compact.json',import.meta.url),'utf8'));
const retry=JSON.parse(fs.readFileSync(new URL('../data/live-snapshots/amazon-round1-missing-retry.compact.json',import.meta.url),'utf8'));

const ids=[...first.snapshots.map(r=>r[0]),...partial.products.map(r=>r[0]),...retry.snapshots.map(r=>r[0])];

test('round1 live coverage reaches 255 unique Amazon ASINs',()=>{
  assert.equal(first.validObservations,90);
  assert.equal(partial.uniqueLiveSnapshots,64);
  assert.equal(retry.validObservations,101);
  assert.equal(ids.length,255);
  assert.equal(new Set(ids).size,255);
});

test('slow retry remained missing-only and zero-cost',()=>{
  assert.equal(retry.baselineCapturedCount,154);
  assert.equal(retry.missingBeforeRun,846);
  assert.equal(retry.requested,846);
  assert.equal(retry.successRatePct,11.9);
  assert.equal(retry.coverage.withPrice,89);
  assert.equal(retry.coverage.withRating,101);
  assert.equal(retry.coverage.withReviews,101);
  assert.equal(retry.policy.providerSpendEur,0);
  assert.equal(retry.policy.paidCallsTriggered,0);
  assert.equal(retry.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(retry.policy.purchaseAuthorized,false);
  assert.equal(retry.policy.trendAuthorized,false);
  assert.equal(retry.policy.minObservationHoursBeforeTrend,24);
});

test('745 bootstrap products remain without a first live snapshot after this round',()=>{
  assert.equal(1000-new Set(ids).size,745);
});
