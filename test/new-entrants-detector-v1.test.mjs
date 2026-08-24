import assert from 'node:assert/strict';
import test from 'node:test';
import {appendSnapshots} from '../public-collection-history.js';
import {detectNewEntrant,buildNewEntrantsFeed} from '../new-entrants-detector.js';

function history(){
  return appendSnapshots([], [
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'NEW',title:'New',sourceRank:90,reviewCount:10,observedAt:'2026-08-22T00:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'NEW',title:'New',sourceRank:35,reviewCount:25,observedAt:'2026-08-24T00:00:00Z'},
    {sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',externalId:'OLD',title:'Old',sourceRank:20,reviewCount:100,observedAt:'2026-08-01T00:00:00Z'},
    {sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',externalId:'OLD',title:'Old',sourceRank:15,reviewCount:120,observedAt:'2026-08-24T00:00:00Z'},
    {sourceKey:'ALIBABA_TOP_RANKING',platform:'ALIBABA',externalId:'DROP',title:'Drop',sourceRank:80,reviewCount:5,observedAt:'2026-08-23T00:00:00Z'},
    {sourceKey:'ALIBABA_TOP_RANKING',platform:'ALIBABA',externalId:'DROP',title:'Drop',sourceRank:140,reviewCount:6,observedAt:'2026-08-24T00:00:00Z'}
  ]).history;
}

test('recent first observation inside ranking threshold is a new entrant',()=>{
  const out=detectNewEntrant(history(),'AMAZON:ID:NEW',{now:'2026-08-24T00:00:00Z'});
  assert.equal(out.newEntrant,true);
  assert.equal(out.status,'NEW_ENTRANT');
  assert.equal(out.accelerating,true);
  assert.equal(out.evidenceClass,'MPR_FIRST_OBSERVED_IN_RANKING');
  assert.equal(out.newProductClaim,false);
  assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.purchaseAuthorized,false);
});

test('long-observed product is not mislabeled as a new entrant',()=>{
  const out=detectNewEntrant(history(),'EBAY:ID:OLD',{now:'2026-08-24T00:00:00Z'});
  assert.equal(out.newEntrant,false);
  assert.equal(out.status,'NOT_NEW_ENTRANT');
  assert.equal(out.score,null);
});

test('recent product that has fallen outside top threshold is not surfaced',()=>{
  const out=detectNewEntrant(history(),'ALIBABA:ID:DROP',{now:'2026-08-24T00:00:00Z'});
  assert.equal(out.newEntrant,false);
  assert.equal(out.latestRank,140);
});

test('feed prioritizes accelerating entrants and never triggers execution',()=>{
  const out=buildNewEntrantsFeed(history(),{now:'2026-08-24T00:00:00Z'});
  assert.equal(out.newEntrants,1);
  assert.equal(out.acceleratingEntrants,1);
  assert.equal(out.rows[0].identity,'AMAZON:ID:NEW');
  assert.match(out.semantics,/NOT_PROOF_OF_PRODUCT_LAUNCH/);
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.externalExecutionTriggered,false);
  assert.equal(out.purchaseAuthorized,false);
});
