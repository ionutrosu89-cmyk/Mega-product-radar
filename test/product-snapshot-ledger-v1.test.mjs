import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProductSnapshot,appendProductSnapshots,buildProductHistoryMetrics,buildSnapshotRefreshPlan} from '../product-snapshot-ledger.js';

test('bootstrap snapshot is not eligible as live trend evidence',()=>{
  const x=normalizeProductSnapshot({platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-01T00:00:00Z',freshnessClass:'BOOTSTRAP_SNAPSHOT_NOT_LIVE',price:20,rating:4.5,reviewCount:100});
  assert.equal(x.ok,true);assert.equal(x.snapshot.liveEvidence,false);assert.equal(x.snapshot.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('append ledger rejects exact duplicate identity/time snapshot',()=>{
  const row={platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:20};
  const x=appendProductSnapshots([row],[row]);
  assert.equal(x.snapshots.length,1);assert.equal(x.rejected.length,1);assert.deepEqual(x.rejected[0].errors,['DUPLICATE_SNAPSHOT']);
});

test('one bootstrap plus one live snapshot still cannot create trend',()=>{
  const x=buildProductHistoryMetrics([
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-01T00:00:00Z',freshnessClass:'BOOTSTRAP_SNAPSHOT_NOT_LIVE',price:20,reviewCount:100,sourceRank:50},
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:21,reviewCount:120,sourceRank:40}
  ]);
  assert.equal(x.trendReadyCount,0);assert.equal(x.products[0].status,'INSUFFICIENT_FRESH_HISTORY');
});

test('two live snapshots compute velocity after default 24h minimum interval',()=>{
  const x=buildProductHistoryMetrics([
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:20,reviewCount:100,sourceRank:50},
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-27T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:22,reviewCount:110,sourceRank:40}
  ]);
  const p=x.products[0];
  assert.equal(x.minObservationHours,24);assert.equal(x.trendReadyCount,1);assert.equal(p.status,'FRESH_HISTORY_READY');assert.equal(p.rankVelocityPerDay,5);assert.equal(p.reviewVelocityPerDay,5);assert.equal(p.priceMovementPerDay,1);assert.equal(p.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('two live snapshots only one hour apart remain ineligible',()=>{
  const x=buildProductHistoryMetrics([
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:20,reviewCount:100,sourceRank:50},
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T01:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:22,reviewCount:110,sourceRank:40}
  ]);
  const p=x.products[0];assert.equal(x.trendReadyCount,0);assert.equal(p.status,'INSUFFICIENT_OBSERVATION_INTERVAL');assert.equal(p.eligibleForTrend,false);assert.equal(p.rankVelocityPerDay,null);assert.equal(p.reviewVelocityPerDay,null);assert.equal(p.priceMovementPerDay,null);
});

test('same-time live observations fail closed for velocity',()=>{
  const rows=[
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:20},
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_OFFICIAL_API',price:21}
  ];
  const x=buildProductHistoryMetrics(rows);assert.equal(x.trendReadyCount,0);assert.equal(x.products[0].status,'INSUFFICIENT_OBSERVATION_INTERVAL');assert.equal(x.products[0].eligibleForTrend,false);
});

test('custom interval can be stricter but never below one hour',()=>{
  const rows=[
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-25T00:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',reviewCount:100},
    {platform:'AMAZON',externalId:'B000000001',observedAt:'2026-08-26T12:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',reviewCount:112}
  ];
  const strict=buildProductHistoryMetrics(rows,{minObservationHours:48});assert.equal(strict.trendReadyCount,0);
  const relaxed=buildProductHistoryMetrics(rows,{minObservationHours:24});assert.equal(relaxed.trendReadyCount,1);
});

test('refresh plan batches 1000 products safely and never auto executes',()=>{
  const products=Array.from({length:1000},(_,i)=>({platform:'AMAZON',externalId:`B${String(i).padStart(9,'0')}`,url:`https://www.amazon.com/dp/B${String(i).padStart(9,'0')}`}));
  const x=buildSnapshotRefreshPlan(products,{batchSize:100,maxProducts:1000});
  assert.equal(x.productCount,1000);assert.equal(x.batchCount,10);assert.equal(x.approvedSpendEur,0);assert.equal(x.externalExecutionTriggered,false);assert.ok(x.batches.every(b=>b.executeAutomatically===false&&b.paid===false));
});
