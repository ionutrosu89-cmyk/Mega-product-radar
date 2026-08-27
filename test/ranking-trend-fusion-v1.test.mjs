import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTrustedTrendFusion,attachTrustedTrendFusion} from '../ranking-trend-fusion-v1.js';

function envelope({category='Home'}={}){
  return{
    expectedIdentity:{marketplace:'AMAZON',externalId:'B001'},
    observedIdentity:{marketplace:'AMAZON',externalId:'B001'},
    evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',
    evidenceStrength:'STRONG',
    source:{name:'TEST',url:'https://example.test/p',observedAt:'2026-08-26T00:00:00.000Z'},
    provenance:{collector:'test',runId:'r1',contentSha256:'a'.repeat(64)},
    sourceRights:{analysisAllowed:true,commercialUseAllowed:false},
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSalesRows:0,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    payload:{rankCategory:category,explicitRank:80}
  };
}

function product(){
  return{rankingEvidence:[{policyDecision:'ACCEPT',evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',envelope:envelope()}]};
}

function trend(overrides={}){
  return{
    historyKey:'AMAZON:B001|EXPLICIT_PRODUCT_BEST_SELLERS_RANK|Home',
    status:'IMPROVING',
    sampleCount:3,
    velocityRankPerDay:10,
    accelerationRankPerDay2:2,
    confirmedAcceleration:true,
    lastObservedAt:'2026-08-26T00:00:00.000Z',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    ...overrides
  };
}

test('trusted current evidence plus fresh comparable exact history enables trend support',()=>{
  const out=evaluateTrustedTrendFusion(product(),{trends:[trend()]},{asOf:'2026-08-27T00:00:00.000Z'});
  assert.equal(out.supportEligible,true);
  assert.equal(out.confirmedAcceleration,true);
  assert.equal(out.rankTrendIsSalesVelocity,false);
  assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.verifiedSalesRows,0);
});

test('missing current trusted ranking evidence holds fusion',()=>{
  const p=product();p.rankingEvidence[0].policyDecision='HOLD';
  const out=evaluateTrustedTrendFusion(p,{trends:[trend()]},{asOf:'2026-08-27T00:00:00.000Z'});
  assert.equal(out.supportEligible,false);
  assert.ok(out.reasons.includes('CURRENT_TRUSTED_RANKING_EVIDENCE_REQUIRED'));
});

test('different category history cannot fuse',()=>{
  const out=evaluateTrustedTrendFusion(product(),{trends:[trend({historyKey:'AMAZON:B001|EXPLICIT_PRODUCT_BEST_SELLERS_RANK|Kitchen'})]},{asOf:'2026-08-27T00:00:00.000Z'});
  assert.equal(out.supportEligible,false);
  assert.ok(out.reasons.includes('COMPARABLE_HISTORY_REQUIRED'));
});

test('stale history cannot support opportunity ranking',()=>{
  const out=evaluateTrustedTrendFusion(product(),{trends:[trend({lastObservedAt:'2026-08-01T00:00:00.000Z'})]},{asOf:'2026-08-27T00:00:00.000Z',maxAgeMs:7*86400000});
  assert.equal(out.supportEligible,false);
  assert.ok(out.reasons.includes('HISTORICAL_TREND_STALE_OR_FUTURE'));
});

test('fewer than two comparable observations cannot support trend fusion',()=>{
  const out=evaluateTrustedTrendFusion(product(),{trends:[trend({sampleCount:1,status:'INSUFFICIENT_COMPARABLE_HISTORY'})]},{asOf:'2026-08-27T00:00:00.000Z'});
  assert.equal(out.supportEligible,false);
  assert.ok(out.reasons.includes('HISTORICAL_TREND_NOT_COMPARABLE'));
});

test('truth class mismatch holds fusion',()=>{
  const out=evaluateTrustedTrendFusion(product(),{trends:[trend({salesEvidenceClass:'VERIFIED_SALES'})]},{asOf:'2026-08-27T00:00:00.000Z'});
  assert.equal(out.supportEligible,false);
  assert.ok(out.reasons.includes('HISTORICAL_TREND_TRUTH_CLASS_INVALID'));
});

test('attachment preserves zero-cost and purchase-false invariants',()=>{
  const products=[product(),product()];
  const attached=attachTrustedTrendFusion(products,{trends:[trend()]},{asOf:'2026-08-27T00:00:00.000Z'});
  assert.equal(attached.eligibleCount,2);
  assert.equal(attached.providerDataSpendEur,0);
  assert.equal(attached.paidDataCallsTriggered,0);
  assert.equal(attached.purchaseAuthorized,false);
  assert.equal(attached.crossPlatformAutoMerge,false);
});
