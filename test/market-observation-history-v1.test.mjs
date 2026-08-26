import assert from 'node:assert/strict';
import test from 'node:test';
import {appendMarketObservationHistory,buildObservationHistoryMetrics,latestMarketObservationView} from '../market-observation-history-v1.js';

const A='11111111-1111-4111-8111-111111111111';
const obs=(overrides={})=>({canonicalProductId:A,platform:'AMAZON',externalId:'B00ABC1234',observedAt:'2026-08-26T10:00:00Z',sourceRank:20,reviewCount:100,price:20,...overrides});

test('history is append-only and rejects exact observation duplicates',()=>{
  const first=appendMarketObservationHistory([],[obs()]);
  const second=appendMarketObservationHistory(first.history,[obs(),obs({observedAt:'2026-08-27T10:00:00Z',sourceRank:10})]);
  assert.equal(second.history.length,2);assert.equal(second.rejected.filter(x=>x.errors.includes('DUPLICATE_OBSERVATION')).length,1);assert.equal(second.appendOnly,true);assert.equal(second.purchaseAuthorized,false);
});

test('24h longitudinal history computes same-source velocity without claiming sales',()=>{
  const h=appendMarketObservationHistory([],[obs(),obs({observedAt:'2026-08-27T10:00:00Z',sourceRank:10,reviewCount:105,price:18})]).history;
  const m=buildObservationHistoryMetrics(h).metrics[0];
  assert.equal(m.status,'LONGITUDINAL_READY');assert.equal(m.rankVelocityPerDay,10);assert.equal(m.reviewVelocityPerDay,5);assert.equal(m.priceMovementPerDay,-2);assert.equal(m.salesEvidenceClass,'NOT_VERIFIED_SALES');assert.equal(m.verifiedSales,null);
});

test('sub-24h history fails closed for trend',()=>{
  const h=appendMarketObservationHistory([],[obs(),obs({observedAt:'2026-08-26T20:00:00Z',sourceRank:1,reviewCount:999})]).history;
  const m=buildObservationHistoryMetrics(h).metrics[0];
  assert.equal(m.status,'INSUFFICIENT_OBSERVATION_INTERVAL');assert.equal(m.eligibleForTrend,false);assert.equal(m.rankVelocityPerDay,null);assert.equal(m.reviewVelocityPerDay,null);
});

test('same canonical product on different platforms stays in separate metric series',()=>{
  const h=appendMarketObservationHistory([],[obs(),obs({observedAt:'2026-08-27T10:00:00Z'}),obs({platform:'EBAY',externalId:'E1'}),obs({platform:'EBAY',externalId:'E1',observedAt:'2026-08-27T10:00:00Z'})]).history;
  const report=buildObservationHistoryMetrics(h);
  assert.equal(report.seriesCount,2);assert.equal(report.longitudinalReady,2);assert.match(report.policy,/NO_CROSS_PLATFORM/);
});

test('same ASIN can preserve multiple explicit ranking surfaces at one timestamp',()=>{
  const h=appendMarketObservationHistory([],[obs({surface:'BSR_CATEGORY::OFFICE PRODUCTS',sourceRank:143}),obs({surface:'BSR_CATEGORY::ROUND RING BINDERS',sourceRank:2})]);
  assert.equal(h.history.length,2);assert.equal(h.rejected.length,0);
  const report=buildObservationHistoryMetrics(h);assert.equal(report.seriesCount,2);assert.notEqual(report.metrics[0].seriesKey,report.metrics[1].seriesKey);
});

test('title changes never split a canonical source history',()=>{
  const h=appendMarketObservationHistory([],[obs({title:'Old title'}),obs({observedAt:'2026-08-27T10:00:00Z',title:'New title'})]).history;
  const report=buildObservationHistoryMetrics(h);assert.equal(report.seriesCount,1);assert.equal(report.metrics[0].observationCount,2);
  const latest=latestMarketObservationView(h);assert.equal(latest[0].title,'New title');
});

test('unbound source history can be longitudinal but is not decision eligible',()=>{
  const a={platform:'AMAZON',externalId:'X1',observedAt:'2026-08-26T10:00:00Z',reviewCount:1},b={...a,observedAt:'2026-08-27T10:00:00Z',reviewCount:2};
  const report=buildObservationHistoryMetrics(appendMarketObservationHistory([],[a,b]).history);
  assert.equal(report.longitudinalReady,1);assert.equal(report.decisionEligibleSeries,0);assert.equal(report.metrics[0].decisionEligible,false);
});
