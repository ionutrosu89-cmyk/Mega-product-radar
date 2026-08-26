import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../data/amazon-leader-bsr-baseline-2026-08-26-v1.json' with {type:'json'};

test('real leader BSR baseline preserves exact observed coverage',()=>{
  assert.equal(baseline.targetCount,13);
  assert.equal(baseline.validPageCount,13);
  assert.equal(baseline.productsWithExplicitBsr,9);
  assert.equal(baseline.explicitBsrEntryCount,18);
  assert.equal(baseline.noBsrObserved.length,4);
  assert.equal(baseline.observations.length,9);
});

test('Avery review-growth leader has explicit BSR but not rank trend yet',()=>{
  const p=baseline.priorityFusionCandidate;
  assert.equal(p.asin,'B00INKVS82');
  assert.equal(p.reviewDelta,14);
  assert.deepEqual(p.bsrEntries,[{rank:143,category:'Office Products'},{rank:2,category:'Round Ring Binders'}]);
  assert.equal(p.rankTrendReady,false);
  assert.equal(p.confirmedTrendFusion,false);
  assert.match(p.reason,/SECOND_SAME_CATEGORY_BSR_AT_LEAST_24H_LATER_REQUIRED/);
});

test('baseline cannot fabricate sales fusion spend or purchase authority',()=>{
  assert.equal(baseline.eligibleForRankVelocityNow,0);
  assert.equal(baseline.policy.productsWithConfirmedTrendFusion,0);
  assert.equal(baseline.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(baseline.policy.providerSpendEur,0);
  assert.equal(baseline.policy.paidCallsTriggered,0);
  assert.equal(baseline.policy.purchaseAuthorized,false);
});

test('persisted category labels contain no parser ASIN suffix',()=>{
  for(const o of baseline.observations)for(const e of o.bsrEntries)assert.doesNotMatch(e.category,/\bASIN\s+B[0-9A-Z]{9}\b/i);
});
