import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTrendSeries,analyzeTrendHistory} from '../trend-intelligence-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const obs=(at,overrides={})=>({canonicalProductId:A,platform:'AMAZON',externalId:'B00ABC1234',surface:'BSR_CATEGORY::Office',observedAt:at,sourceRank:100,reviewCount:100,price:20,...overrides});

test('less than 24h is insufficient even with dramatic movement',()=>{
 const r=analyzeTrendSeries([obs('2026-08-26T00:00:00Z'),obs('2026-08-26T12:00:00Z',{sourceRank:1,reviewCount:500})],{now:'2026-08-26T12:00:00Z'});
 assert.equal(r.status,'INSUFFICIENT_HISTORY');assert.equal(r.autoPromoteOpportunityStage,false);assert.equal(r.verifiedSales,null);
});

test('24h positive movement is an early signal, not a persistent trend',()=>{
 const r=analyzeTrendSeries([obs('2026-08-25T00:00:00Z'),obs('2026-08-26T00:00:00Z',{sourceRank:80,reviewCount:110,price:20})],{now:'2026-08-26T01:00:00Z'});
 assert.equal(r.status,'EARLY_SIGNAL');assert.ok(r.trendScore>=60);assert.ok(r.confidence<80);
});

test('strong recent spike with weak seven-day behavior is classified as spike or reversal',()=>{
 const r=analyzeTrendSeries([
  obs('2026-08-18T00:00:00Z',{sourceRank:100,reviewCount:100}),
  obs('2026-08-25T00:00:00Z',{sourceRank:120,reviewCount:100}),
  obs('2026-08-26T00:00:00Z',{sourceRank:80,reviewCount:120})
 ],{now:'2026-08-26T01:00:00Z'});
 assert.equal(r.status,'SPIKE_OR_REVERSAL');
});

test('seven-day positive evidence can be emerging but not automatically persistent',()=>{
 const r=analyzeTrendSeries([
  obs('2026-08-18T00:00:00Z',{sourceRank:120,reviewCount:90}),
  obs('2026-08-25T00:00:00Z',{sourceRank:100,reviewCount:100}),
  obs('2026-08-26T00:00:00Z',{sourceRank:90,reviewCount:105})
 ],{now:'2026-08-26T01:00:00Z'});
 assert.equal(r.status,'EMERGING_TREND');assert.equal(r.explanation.spikeIsNotTrend,true);
});

test('30d persistence requires both seven and thirty day support',()=>{
 const r=analyzeTrendSeries([
  obs('2026-07-20T00:00:00Z',{sourceRank:180,reviewCount:50}),
  obs('2026-07-27T00:00:00Z',{sourceRank:160,reviewCount:60}),
  obs('2026-08-19T00:00:00Z',{sourceRank:120,reviewCount:90}),
  obs('2026-08-26T00:00:00Z',{sourceRank:90,reviewCount:120})
 ],{now:'2026-08-26T01:00:00Z'});
 assert.equal(r.status,'PERSISTENT_TREND');assert.ok(r.confidence>=60);
});

test('same ASIN on two surfaces remains two trend series',()=>{
 const h=[
  obs('2026-08-25T00:00:00Z'),obs('2026-08-26T00:00:00Z',{sourceRank:80,reviewCount:110}),
  obs('2026-08-25T00:00:00Z',{surface:'BSR_CATEGORY::Binders',sourceRank:20}),obs('2026-08-26T00:00:00Z',{surface:'BSR_CATEGORY::Binders',sourceRank:10})
 ];
 const r=analyzeTrendHistory(h,{now:'2026-08-26T01:00:00Z'});
 assert.equal(r.seriesCount,2);assert.match(r.policy,/SAME_SOURCE_SURFACE_ONLY/);
});

test('unbound public history may be analyzed but cannot be decision eligible',()=>{
 const r=analyzeTrendSeries([
  {platform:'AMAZON',externalId:'X1',surface:'PUBLIC',observedAt:'2026-08-25T00:00:00Z',reviewCount:1},
  {platform:'AMAZON',externalId:'X1',surface:'PUBLIC',observedAt:'2026-08-26T00:00:00Z',reviewCount:2}
 ],{now:'2026-08-26T01:00:00Z'});
 assert.equal(r.decisionEligible,false);assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
