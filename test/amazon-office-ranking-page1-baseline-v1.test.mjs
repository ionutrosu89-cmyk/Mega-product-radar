import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../data/amazon-office-ranking-page1-baseline-2026-08-26.json' with {type:'json'};

test('persisted Office Products page 1 baseline records only observed explicit rank metadata',()=>{
  assert.equal(baseline.rankEvidenceCount,30);
  assert.deepEqual(baseline.rankRangeObserved,{min:1,max:30});
  assert.equal(baseline.rankEvidenceClass,'EXPLICIT_PUBLIC_RANK_BADGE');
  assert.equal(baseline.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(baseline.purchaseAuthorized,false);
  assert.equal(baseline.providerSpendEur,0);
  assert.equal(baseline.paidCallsTriggered,0);
});

test('absence of Round2 leader from first 30 never becomes a fabricated rank or demand conclusion',()=>{
  assert.equal(baseline.round2ReviewGrowthLeaderOverlapCount,0);
  assert.equal(baseline.priorityLeaderObservedInThisSnapshot,false);
  assert.equal(baseline.eligibleForRankVelocityNow,false);
  assert.match(baseline.nextRankVelocityGate,/SECOND_EXPLICIT_RANK_SNAPSHOT/);
});
