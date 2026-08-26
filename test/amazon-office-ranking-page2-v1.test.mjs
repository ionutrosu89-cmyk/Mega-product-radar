import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/amazon-public-ranking-snapshot.yml','utf8');
const marker=JSON.parse(fs.readFileSync('data/amazon-office-ranking-page2-trigger-2026-08-26.json','utf8'));
const first=JSON.parse(fs.readFileSync('data/amazon-office-ranking-snapshot-2026-08-26-v1.json','utf8'));

test('first Office Products public rank snapshot is persisted with zero leader intersection',()=>{
  assert.equal(first.sourceRunId,32929490898);
  assert.equal(first.rankEvidenceCount,30);
  assert.equal(first.rankPairs.length,30);
  assert.deepEqual(first.rankPairs.map(x=>x[0]),Array.from({length:30},(_,i)=>i+1));
  assert.equal(first.leaderIntersection.matchedLeaderCount,0);
  assert.equal(first.policy.explicitRankOnly,true);
  assert.equal(first.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(first.policy.providerSpendEur,0);
});

test('page2 trigger is one-time zero-cost and uses explicit rank only',()=>{
  assert.equal(marker.triggerId,'AMAZON_OFFICE_PRODUCTS_RANKING_PAGE2_2026_08_26');
  assert.equal(marker.page,2);
  assert.equal(marker.providerSpendEur,0);
  assert.equal(marker.paidCallsAuthorized,false);
  assert.equal(marker.purchaseAuthorized,false);
  assert.equal(marker.explicitRankOnly,true);
  assert.equal(marker.htmlPositionIsNotRank,true);
  assert.match(workflow,/amazon-office-ranking-page2-trigger-2026-08-26\.json/);
  assert.match(workflow,/pg=2&language=en_US/);
  assert.match(workflow,/rankEvidenceClass!=='EXPLICIT_PUBLIC_RANK_BADGE'/);
});
