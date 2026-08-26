import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compact=JSON.parse(fs.readFileSync('data/live-snapshots/amazon-round2-2026-08-26.compact.json','utf8'));
const leaders=JSON.parse(fs.readFileSync('data/amazon-round2-preliminary-leaders-v1.json','utf8'));

test('persisted Round2 evidence matches the successful zero-cost run',()=>{
  assert.equal(compact.sourceRunId,32928600911);
  assert.equal(compact.requested,255);
  assert.equal(compact.validObservations,54);
  assert.equal(compact.successRatePct,21.2);
  assert.equal(compact.plan.eligibleCount,255);
  assert.equal(compact.plan.blockedCount,0);
  assert.equal(compact.policy.providerSpendEur,0);
  assert.equal(compact.policy.paidCallsTriggered,0);
  assert.equal(compact.policy.purchaseAuthorized,false);
  assert.equal(compact.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(compact.policy.rankVelocityAvailable,false);
});

test('review comparability sanity gate excludes exactly the two observed anomalies',()=>{
  assert.equal(compact.sanitySummary.trendEligibleAfterSanity,52);
  assert.equal(compact.sanitySummary.reviewComparabilityAnomalies,2);
  assert.deepEqual(compact.reviewComparabilityAnomalies.map(x=>x.asin).sort(),['B07PX6QSH2','B09S6R2M8V']);
  assert.ok(compact.reviewComparabilityAnomalies.every(x=>x.trendEligible===false));
});

test('preliminary leaders are review-growth evidence only and cannot auto promote',()=>{
  assert.equal(leaders.reviewGrowthLeaders,13);
  assert.equal(leaders.leaders.length,13);
  assert.equal(leaders.policy.evidenceLevel,'PRELIMINARY_REVIEW_PRICE_ONLY');
  assert.equal(leaders.policy.eligibleForRankTrend,false);
  assert.equal(leaders.policy.eligibleForDemandConfirmation,false);
  assert.equal(leaders.policy.eligibleForVerifiedSales,false);
  assert.equal(leaders.policy.maximumFunnelContribution,'PROMISING_SUPPORT_ONLY');
  assert.equal(leaders.policy.autoPromoteOpportunityStage,false);
  assert.equal(leaders.policy.purchaseAuthorized,false);
  assert.equal(leaders.policy.paidCallsTriggered,0);
});
