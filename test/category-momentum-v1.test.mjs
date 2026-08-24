import assert from 'node:assert/strict';
import test from 'node:test';
import {appendSnapshots} from '../public-collection-history.js';
import {buildCategoryMomentum} from '../category-momentum.js';

function snap(externalId,category,rank,reviews,observedAt){
  return {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId,title:externalId,categoryLabel:category,sourceRank:rank,reviewCount:reviews,observedAt};
}

test('category momentum aggregates rising products without claiming verified sales',()=>{
  const history=appendSnapshots([], [
    snap('A','Desk organization',80,100,'2026-08-20T00:00:00Z'),
    snap('A','Desk organization',40,140,'2026-08-24T00:00:00Z'),
    snap('B','Desk organization',60,50,'2026-08-20T00:00:00Z'),
    snap('B','Desk organization',30,75,'2026-08-24T00:00:00Z'),
    snap('C','Kitchen',10,200,'2026-08-20T00:00:00Z'),
    snap('C','Kitchen',25,202,'2026-08-24T00:00:00Z')
  ]).history;
  const out=buildCategoryMomentum(history,{newEntrants:{now:'2026-08-24T00:00:00Z',lookbackDays:7}});
  const desk=out.rows.find(x=>x.category==='Desk organization');
  const kitchen=out.rows.find(x=>x.category==='Kitchen');
  assert.equal(desk.productsWithTrend,2);
  assert.equal(desk.rising,2);
  assert.ok(desk.medianRankVelocity>0);
  assert.ok(['SURGING','RISING'].includes(desk.signal));
  assert.equal(kitchen.cooling,1);
  assert.equal(desk.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.purchaseAuthorized,false);
});

test('single-product category fails depth rather than being called surging',()=>{
  const history=appendSnapshots([], [
    snap('ONLY','Tiny niche',90,10,'2026-08-20T00:00:00Z'),
    snap('ONLY','Tiny niche',5,80,'2026-08-24T00:00:00Z')
  ]).history;
  const out=buildCategoryMomentum(history,{newEntrants:{now:'2026-08-24T00:00:00Z'}});
  assert.equal(out.rows[0].signal,'INSUFFICIENT_DEPTH');
  assert.equal(out.rows[0].productsWithTrend,1);
});

test('latest observed category assignment is used deterministically',()=>{
  const history=appendSnapshots([], [
    snap('MOVE','Old category',70,10,'2026-08-20T00:00:00Z'),
    snap('MOVE','New category',50,20,'2026-08-24T00:00:00Z')
  ]).history;
  const out=buildCategoryMomentum(history,{newEntrants:{now:'2026-08-24T00:00:00Z'}});
  assert.equal(out.rows.length,1);
  assert.equal(out.rows[0].category,'New category');
});
