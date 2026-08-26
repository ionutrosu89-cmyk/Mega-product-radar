import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptAmazonPublicRankingSnapshot,adaptAmazonExplicitBsrSnapshot,adaptAbsoluteProductSnapshot} from '../real-data-adapters-v1.js';
import {appendMarketObservationHistory,buildObservationHistoryMetrics} from '../market-observation-history-v1.js';

const A='11111111-1111-4111-8111-111111111111';
const aliases=[{canonicalProductId:A,platform:'AMAZON',externalId:'B00ABC1234'}];

test('public ranking adapter binds only exact marketplace alias',()=>{
 const r=adaptAmazonPublicRankingSnapshot({generatedAt:'2026-08-26T10:00:00Z',categoryKey:'amazon:office:best-sellers',categoryLabel:'Office Products',rankPairs:[[1,'B00ABC1234'],[2,'B00OTHER01']]},aliases);
 assert.equal(r.observations.length,2);assert.equal(r.boundCount,1);assert.equal(r.unboundCount,1);assert.equal(r.observations[0].canonicalProductId,A);assert.equal(r.observations[1].canonicalProductId,null);
});

test('explicit BSR keeps multiple categories as separate metric surfaces',()=>{
 const r=adaptAmazonExplicitBsrSnapshot({observedAt:'2026-08-26T10:00:00Z',observations:[{asin:'B00ABC1234',bsrEntries:[{rank:143,category:'Office Products'},{rank:2,category:'Round Ring Binders'}]}]},aliases);
 assert.equal(r.observations.length,2);
 const h=appendMarketObservationHistory([],r.observations);
 assert.equal(h.history.length,2);assert.equal(h.rejected.length,0);
 const metrics=buildObservationHistoryMetrics(h.history);assert.equal(metrics.seriesCount,2);
});

test('derived deltas are rejected as observations',()=>{
 const r=adaptAbsoluteProductSnapshot({generatedAt:'2026-08-26T10:00:00Z',rows:[{asin:'B00ABC1234',title:'X',reviewDelta:14,priceDelta:-2}]},aliases);
 assert.equal(r.observations.length,0);assert.ok(r.rejected[0].errors.includes('DERIVED_DELTAS_ARE_NOT_OBSERVATIONS'));
});

test('absolute product metrics become observations without verified sales claims',()=>{
 const r=adaptAbsoluteProductSnapshot({generatedAt:'2026-08-26T10:00:00Z',rows:[{asin:'B00ABC1234',title:'X',reviewCount:100,price:25,rating:4.5}]},aliases);
 assert.equal(r.observations.length,1);assert.equal(r.observations[0].reviewCount,100);assert.equal(r.observations[0].verifiedSales,null);assert.equal(r.purchaseAuthorized,false);
});
