import assert from 'node:assert/strict';
import test from 'node:test';
import {PUBLIC_COLLECTION_CADENCE,buildCollectionSchedule,normalizeSnapshot,appendSnapshots,productHistoryMetrics,buildHistoryRadarFeed} from '../public-collection-history.js';

test('scheduler plans recurring public collection without executing it',()=>{
  const s=buildCollectionSchedule({sourceKeys:['AMAZON_BEST_SELLERS','AMAZON_MOVERS_SHAKERS','ETSY_OPEN_API'],lastCollectedAt:{AMAZON_BEST_SELLERS:'2026-08-23T17:00:00Z',AMAZON_MOVERS_SHAKERS:'2026-08-24T10:00:00Z',ETSY_OPEN_API:'2026-08-20T00:00:00Z'},now:'2026-08-24T18:00:00Z'});
  assert.equal(s.ok,true);
  assert.equal(s.tasks.length,3);
  assert.ok(s.tasks.some(x=>x.sourceKey==='AMAZON_BEST_SELLERS'&&x.due===true));
  assert.equal(s.externalExecutionTriggered,false);
  assert.equal(s.paidCallsTriggered,0);
});

test('cadence prioritizes ranking refresh more often than breadth discovery',()=>{
  assert.equal(PUBLIC_COLLECTION_CADENCE.AMAZON_MOVERS_SHAKERS.intervalHours,12);
  assert.equal(PUBLIC_COLLECTION_CADENCE.AMAZON_BEST_SELLERS.intervalHours,24);
  assert.equal(PUBLIC_COLLECTION_CADENCE.ETSY_OPEN_API.intervalHours,168);
});

test('snapshot preserves null values and never upgrades rank into sales',()=>{
  const x=normalizeSnapshot({sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',surface:'BEST_SELLERS',externalId:'A1',title:'Desk Stand',sourceRank:4,price:null,reviewCount:null,observedAt:'2026-08-24T10:00:00Z'});
  assert.equal(x.ok,true);
  assert.equal(x.snapshot.price,null);
  assert.equal(x.snapshot.reviewCount,null);
  assert.equal(x.snapshot.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(x.snapshot.appendOnly,true);
});

test('snapshot history is append-only and exact duplicate observations are ignored',()=>{
  const records=[
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Desk Stand',sourceRank:12,observedAt:'2026-08-22T10:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Desk Stand',sourceRank:8,observedAt:'2026-08-23T10:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Desk Stand',sourceRank:8,observedAt:'2026-08-23T10:00:00Z'}
  ];
  const out=appendSnapshots([],records);
  assert.equal(out.history.length,2);
  assert.equal(out.added,2);
  assert.equal(out.appendOnly,true);
});

test('history metrics calculate rank, review and price velocity without claiming verified sales',()=>{
  const history=appendSnapshots([], [
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Desk Stand',sourceRank:20,price:20,reviewCount:100,observedAt:'2026-08-20T00:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Desk Stand',sourceRank:10,price:22,reviewCount:120,observedAt:'2026-08-24T00:00:00Z'}
  ]).history;
  const m=productHistoryMetrics(history,'AMAZON:ID:A1');
  assert.equal(m.rankDelta,10);
  assert.equal(m.rankVelocityPerDay,2.5);
  assert.equal(m.reviewDelta,20);
  assert.equal(m.reviewVelocityPerDay,5);
  assert.equal(m.priceDeltaPct,10);
  assert.equal(m.trendSignal,'RISING_FAST');
  assert.equal(m.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('history radar feed requires at least two observations per product',()=>{
  const history=appendSnapshots([], [
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'A',sourceRank:30,observedAt:'2026-08-20T00:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'A',sourceRank:10,observedAt:'2026-08-24T00:00:00Z'},
    {sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',externalId:'E1',title:'E',sourceRank:3,observedAt:'2026-08-24T00:00:00Z'}
  ]).history;
  const feed=buildHistoryRadarFeed(history);
  assert.equal(feed.productsTracked,2);
  assert.equal(feed.productsWithTrend,1);
  assert.equal(feed.purchaseAuthorized,false);
});
