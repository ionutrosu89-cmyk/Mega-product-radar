import test from 'node:test';
import assert from 'node:assert/strict';
import {earliestObservedAt,metricRefreshReadiness,buildMetricComparison} from '../amazon-metric-comparison-v1.js';

const bridge={schemaVersion:'MPR_AMAZON_ROUND1_CANONICAL_BRIDGE_V1',observations:[
  {canonicalKey:'AMAZON:AMAZON:B0001',externalId:'B0001',price:20,currency:'USD',rating:4.5,reviewCount:100,observedAt:'2026-08-30T10:00:00Z'},
  {canonicalKey:'AMAZON:AMAZON:B0002',externalId:'B0002',price:null,currency:null,rating:4.2,reviewCount:null,observedAt:'2026-08-30T10:05:00Z'}
]};

test('readiness blocks refresh before 24 hours',()=>{
  assert.equal(earliestObservedAt(bridge),'2026-08-30T10:00:00.000Z');
  const r=metricRefreshReadiness(bridge,{now:'2026-08-31T09:59:59Z',minIntervalMs:86400000});
  assert.equal(r.ready,false);
  assert.equal(r.nextEligibleAt,'2026-08-31T10:00:00.000Z');
});

test('comparison only uses time-separated current observations',()=>{
  const current=[
    {externalId:'B0001',price:22,currency:'USD',rating:4.6,reviewCount:110,observedAt:'2026-08-31T10:10:00Z'},
    {externalId:'B0002',price:15,currency:'USD',rating:4.3,reviewCount:10,observedAt:'2026-08-31T09:00:00Z'}
  ];
  const out=buildMetricComparison(bridge,current,{now:'2026-08-31T10:10:00Z',minIntervalMs:86400000});
  assert.equal(out.manifest.baselineCount,2);
  assert.equal(out.manifest.comparableCount,1);
  assert.equal(out.comparisons[0].delta.price,2);
  assert.ok(Math.abs(out.comparisons[0].delta.rating-0.1)<1e-9);
  assert.equal(out.comparisons[0].delta.reviewCount,10);
  assert.equal(out.comparisons[0].reviewGrowthIsSales,false);
  assert.equal(out.policy.demandTrendAuthorized,false);
  assert.equal(out.policy.purchaseAuthorized,false);
  assert.equal(out.policy.providerSpendEur,0);
});

test('comparison fails closed if global minimum interval is not reached',()=>{
  assert.throws(()=>buildMetricComparison(bridge,[],{now:'2026-08-30T20:00:00Z',minIntervalMs:86400000}),/INTERVAL_NOT_REACHED/);
});
