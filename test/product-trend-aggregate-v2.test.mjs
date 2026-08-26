import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateProductTrend,aggregateTrendReportByProduct} from '../product-trend-aggregate-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const s=(surface,status,trendScore,confidence,overrides={})=>({canonicalProductId:A,decisionEligible:true,seriesKey:`canonical:${A}|AMAZON|X|${surface}`,surface,status,trendScore,confidence,...overrides});

test('two positive surfaces corroborate without score inflation above their evidence',()=>{
  const r=aggregateProductTrend([s('OFFICE','PERSISTENT_TREND',80,70),s('BINDERS','EMERGING_TREND',70,60)],A);
  assert.equal(r.status,'PERSISTENT_TREND');
  assert.ok(r.trendScore>=70&&r.trendScore<=80);
  assert.equal(r.surfaceConsensusPct,100);
  assert.ok(r.confidence<=100);
  assert.equal(r.verifiedSales,null);
});

test('conflicting canonical surfaces force mixed review and lower confidence',()=>{
  const r=aggregateProductTrend([s('OFFICE','PERSISTENT_TREND',85,80),s('BINDERS','DECLINING',25,80)],A);
  assert.equal(r.status,'MIXED_OR_CONFLICTED');
  assert.equal(r.conflicted,true);
  assert.ok(r.confidence<80);
  assert.deepEqual(r.reasons,['CONFLICTING_CANONICAL_SURFACES_REQUIRE_REVIEW']);
});

test('spike is not upgraded to persistent trend by aggregation',()=>{
  const r=aggregateProductTrend([s('OFFICE','SPIKE_OR_REVERSAL',82,55)],A);
  assert.equal(r.status,'SPIKE_OR_REVERSAL');
  assert.equal(r.autoPromoteOpportunityStage,false);
});

test('unbound and wrong-product surfaces never enter canonical product aggregate',()=>{
  const r=aggregateProductTrend([
    s('OFFICE','EMERGING_TREND',70,60),
    s('UNBOUND','PERSISTENT_TREND',99,99,{canonicalProductId:null,decisionEligible:false}),
    s('OTHER','PERSISTENT_TREND',99,99,{canonicalProductId:B})
  ],A);
  assert.equal(r.surfaceCount,1);
  assert.equal(r.trendScore,70);
});

test('report emits one aggregate per canonical product and counts unbound separately',()=>{
  const report=aggregateTrendReportByProduct({analyses:[
    s('A1','EMERGING_TREND',70,60),
    s('A2','EMERGING_TREND',75,65),
    s('B1','DECLINING',30,70,{canonicalProductId:B}),
    s('U','EARLY_SIGNAL',70,30,{canonicalProductId:null,decisionEligible:false})
  ]});
  assert.equal(report.productCount,2);
  assert.equal(report.unboundSeries,1);
  assert.equal(report.purchaseAuthorized,false);
});

test('missing canonical identity fails closed',()=>{
  const r=aggregateProductTrend([],null);
  assert.equal(r.decisionEligible,false);
  assert.equal(r.status,'INSUFFICIENT_HISTORY');
  assert.equal(r.trendScore,null);
});
