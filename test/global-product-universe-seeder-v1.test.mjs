import assert from 'node:assert/strict';
import test from 'node:test';
import {seedGlobalProductUniverse,buildUniverseMilestoneStatus,planSourceMix} from '../global-product-universe-seeder.js';

test('seeder keeps latest observation per exact platform identity and preserves history semantics',()=>{
  const seed=seedGlobalProductUniverse([
    {sourceKey:'AMAZON_BEST_SELLERS',externalId:'B001',title:'Desk Holder',sourceRank:9,observedAt:'2026-08-20T10:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',externalId:'B001',title:'Desk Holder',sourceRank:4,observedAt:'2026-08-24T10:00:00Z'},
    {sourceKey:'ALIBABA_TOP_RANKING',url:'https://www.alibaba.com/product-detail/desk-holder',title:'Desk Holder',sourceRank:7,observedAt:'2026-08-24T10:00:00Z'}
  ]);
  assert.equal(seed.acceptedObservationCount,3);
  assert.equal(seed.uniqueProductObservationCount,2);
  assert.equal(seed.duplicateObservationCount,1);
  assert.equal(seed.products.find(x=>x.platform==='AMAZON').sourceRank,4);
  assert.equal(seed.purchaseAuthorized,false);
});

test('cross platform matches are review hints and never auto merged',()=>{
  const seed=seedGlobalProductUniverse([
    {sourceKey:'AMAZON_BEST_SELLERS',externalId:'B002',title:'Acme Magnetic Car Sun Visor Sunglasses Holder',brand:'Acme'},
    {sourceKey:'EBAY_BEST_SELLING',externalId:'E002',title:'Acme Magnetic Car Sun Visor Sunglasses Holder',brand:'Acme'}
  ]);
  assert.equal(seed.uniqueProductObservationCount,2);
  assert.ok(seed.crossPlatformReview.length>=1);
  assert.ok(seed.crossPlatformReview.every(x=>x.autoMerge===false));
});

test('invalid observations are rejected without fabricating products',()=>{
  const seed=seedGlobalProductUniverse([{sourceKey:'AMAZON_BEST_SELLERS',title:''}]);
  assert.equal(seed.uniqueProductObservationCount,0);
  assert.equal(seed.rejectedCount,1);
});

test('milestone status reports remaining products conservatively',()=>{
  const m=buildUniverseMilestoneStatus({uniqueProductObservationCount:1200},[1000,5000,10000]);
  assert.equal(m.milestones[0].reached,true);
  assert.equal(m.next.target,5000);
  assert.equal(m.next.remaining,3800);
});

test('source mix flags excessive dependence on a single platform',()=>{
  assert.equal(planSourceMix({amazon:9000,ebay:500,alibaba:500,target:10000}).diversificationStatus,'TOO_CONCENTRATED');
  assert.equal(planSourceMix({amazon:5000,ebay:2500,alibaba:2500,target:10000}).diversificationStatus,'HEALTHY');
});
