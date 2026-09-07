import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCurrentTop25Window,compareCurrentWindows} from '../current-top25-window-engine-v1.js';

const product=(id,rank)=>({name:`Product ${id}`,externalId:id,rank,sourceUrl:`https://example.com/p/${id}`,sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',sourceLabel:'eBay Buy Marketing API',evidenceClass:'DIRECT',salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES'});
const snapshot=(day,rankA=1,rankB=2)=>({observedAt:`2026-09-${String(day).padStart(2,'0')}T12:00:00Z`,products:Array.from({length:25},(_,index)=>index===0?product('A',rankA):index===1?product('B',rankB):product(`P${index}`,index+1))});

test('7D ranking rewards persistence and rank quality without claiming unit sales',()=>{
  const result=buildCurrentTop25Window({snapshots:[snapshot(1,8,1),snapshot(2,7,1),snapshot(3,6,2),snapshot(4,5,2),snapshot(5,4,3),snapshot(6,3,4),snapshot(7,2,5)],windowDays:7,windowEnd:new Date('2026-09-08T00:00:00Z'),platform:'EBAY',market:'EBAY_US',nicheId:'CASA'});
  assert.equal(result.windowDays,7);
  assert.equal(result.observedDays,7);
  assert.equal(result.productCount,25);
  assert.equal(result.evidenceClass,'DERIVED');
  assert.equal(result.products.length,25);
  assert.equal(result.products.every(row=>row.salesEvidenceClass==='PLATFORM_RANK_NOT_UNIT_SALES'),true);
  assert.equal(result.products.every(row=>row.rankingBasis==='WINDOW_PERSISTENCE_FROM_DIRECT_PLATFORM_RANK'),true);
});

test('window is insufficient when fewer than 25 unique current products are available',()=>{
  const sparse={observedAt:'2026-09-07T12:00:00Z',products:Array.from({length:25},(_,index)=>product(index<10?`X${index}`:'',index+1))};
  const result=buildCurrentTop25Window({snapshots:[sparse],windowDays:7,windowEnd:new Date('2026-09-08T00:00:00Z'),platform:'EBAY',market:'EBAY_US',nicheId:'AUTO'});
  assert.equal(result.productCount,10);
  assert.equal(result.evidenceClass,'INSUFFICIENT_DATA');
  assert.equal(result.freshnessStatus,'INSUFFICIENT_DATA');
});

test('stale snapshots outside the selected window are excluded',()=>{
  const result=buildCurrentTop25Window({snapshots:[snapshot(1),snapshot(7)],windowDays:7,windowEnd:new Date('2026-09-08T12:00:00Z'),platform:'EBAY',market:'EBAY_US',nicheId:'PET'});
  assert.equal(result.observedDays,1);
  assert.equal(result.products[0].windowMetrics.observedDays,1);
});

test('7D vs 30D comparison exposes acceleration direction rather than fabricated sales growth',()=>{
  const top7={products:[{externalId:'A',rank:2,windowMetrics:{windowScore:.9}},{externalId:'NEW',rank:5,windowMetrics:{windowScore:.7}}]};
  const top30={products:[{externalId:'A',rank:8,windowMetrics:{windowScore:.6}}]};
  const compared=compareCurrentWindows(top7,top30);
  assert.equal(compared[0].acceleration.direction,'UP');
  assert.equal(compared[0].acceleration.rankDelta,6);
  assert.equal(compared[1].acceleration.direction,'NEW');
  assert.equal(compared[1].acceleration.rankDelta,null);
});
