import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLeaderBsrHistory} from '../amazon-leader-bsr-history-v1.js';

const baseline={
  schemaVersion:'MPR_AMAZON_LEADER_BSR_BASELINE_V1',observedAt:'2026-08-26T06:31:17.808Z',
  observations:[{asin:'B00INKVS82',bsrEntries:[{rank:143,category:'Office Products'},{rank:2,category:'Round Ring Binders'}]}]
};
const policy={providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false};

function current(generatedAt,entries){return{schemaVersion:'MPR_AMAZON_LEADER_BSR_SNAPSHOT_V1',generatedAt,policy,observations:[{asin:'B00INKVS82',bsrEntries:entries}]};}

test('blocks rank velocity before minimum 24h',()=>{
  const r=buildLeaderBsrHistory({baseline,current:current('2026-08-27T06:30:00.000Z',[{rank:140,category:'Office Products'}])});
  assert.equal(r.ok,false);assert.equal(r.status,'TOO_EARLY');assert.equal(r.error,'MINIMUM_24H_INTERVAL_NOT_MET');
});

test('builds positive rank velocity only from same ASIN and same category after 24h',()=>{
  const r=buildLeaderBsrHistory({baseline,current:current('2026-08-27T06:31:17.808Z',[{rank:133,category:'Office Products'},{rank:1,category:'Round Ring Binders'}])});
  assert.equal(r.ok,true);assert.equal(r.eligibleProductCount,1);assert.equal(r.comparableCategoryCount,2);
  assert.equal(r.rows[0].rankVelocityPerDay,5.5);
  assert.equal(r.rows[0].trendEvidenceClass,'LONGITUDINAL_PUBLIC_RANKING');
  assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');assert.equal(r.purchaseAuthorized,false);
});

test('mixed category directions fail closed instead of choosing an arbitrary primary rank',()=>{
  const r=buildLeaderBsrHistory({baseline,current:current('2026-08-27T06:31:17.808Z',[{rank:133,category:'Office Products'},{rank:3,category:'Round Ring Binders'}])});
  assert.equal(r.ok,true);assert.equal(r.conflictProductCount,1);assert.equal(r.eligibleProductCount,0);
  assert.equal(r.rows[0].categorySignalsConflict,true);assert.equal(r.rows[0].rankVelocityPerDay,null);
  assert.equal(r.rows[0].trendEvidenceClass,'LONGITUDINAL_PUBLIC_RANKING_CONFLICT');
});

test('unseen category cannot be paired to a different baseline category',()=>{
  const r=buildLeaderBsrHistory({baseline,current:current('2026-08-27T06:31:17.808Z',[{rank:1,category:'Binders'}])});
  assert.equal(r.ok,true);assert.equal(r.comparableCategoryCount,0);assert.equal(r.blockedCount,1);
  assert.equal(r.blocked[0].error,'SAME_CATEGORY_BASELINE_MISSING');
});

test('unsafe snapshot policy is blocked',()=>{
  const x=current('2026-08-27T06:31:17.808Z',[{rank:133,category:'Office Products'}]);x.policy.providerSpendEur=1;
  const r=buildLeaderBsrHistory({baseline,current:x});assert.equal(r.ok,false);assert.equal(r.error,'CURRENT_SNAPSHOT_POLICY_INVALID');
});
