import assert from 'node:assert/strict';
import test from 'node:test';
import {bridgeCollectorBatches} from '../public-collector-universe-bridge.js';

test('collector batches feed one global universe with milestone and source-mix status',()=>{
  const out=bridgeCollectorBatches([
    {sourceKey:'AMAZON_BEST_SELLERS',records:[{sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Desk Stand',sourceRank:1}]},
    {sourceKey:'EBAY_BEST_SELLING',records:[{sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',externalId:'E1',title:'Car Holder',sourceRank:1}]},
    {sourceKey:'ALIBABA_TOP_RANKING',records:[{sourceKey:'ALIBABA_TOP_RANKING',platform:'ALIBABA',externalId:'B1',title:'Storage Hook',sourceRank:2}]}
  ]);
  assert.equal(out.universe.uniqueProductObservationCount,3);
  assert.equal(out.sourceMix.total,3);
  assert.equal(out.milestone.current,3);
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.externalExecutionTriggered,false);
  assert.equal(out.purchaseAuthorized,false);
});

test('bridge keeps exact same-platform identity dedupe behavior',()=>{
  const out=bridgeCollectorBatches([{sourceKey:'AMAZON_BEST_SELLERS',records:[
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'Old title',sourceRank:5,observedAt:'2026-08-20T00:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'A1',title:'New title',sourceRank:2,observedAt:'2026-08-24T00:00:00Z'}
  ]}]);
  assert.equal(out.universe.uniqueProductObservationCount,1);
  assert.equal(out.universe.products[0].title,'New title');
});
