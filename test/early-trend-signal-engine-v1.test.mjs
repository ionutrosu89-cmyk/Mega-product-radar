import assert from 'node:assert/strict';
import test from 'node:test';
import {appendSnapshots} from '../public-collection-history.js';
import {earlyTrendSignal,buildEarlyTrendRadar} from '../early-trend-signal-engine.js';

test('insufficient history fails closed',()=>{
  const x=earlyTrendSignal({observationCount:1});
  assert.equal(x.eligible,false);
  assert.equal(x.signal,'INSUFFICIENT_HISTORY');
  assert.equal(x.score,null);
});

test('new fast mover becomes NEW_AND_ACCELERATING without claiming sales',()=>{
  const x=earlyTrendSignal({observationCount:6,daysObserved:6,rankVelocityPerDay:4,reviewVelocityPerDay:18,top100PersistencePct:100,top10PersistencePct:50});
  assert.equal(x.eligible,true);
  assert.equal(x.signal,'NEW_AND_ACCELERATING');
  assert.ok(x.score>=65);
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(x.purchaseAuthorized,false);
});

test('negative rank velocity is cooling',()=>{
  const x=earlyTrendSignal({observationCount:5,daysObserved:20,rankVelocityPerDay:-1,reviewVelocityPerDay:1,top100PersistencePct:60,top10PersistencePct:0});
  assert.equal(x.signal,'COOLING');
});

test('radar ranks accelerating products ahead of cooling products',()=>{
  const history=appendSnapshots([], [
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'FAST',title:'Fast',sourceRank:40,reviewCount:100,observedAt:'2026-08-20T00:00:00Z'},
    {sourceKey:'AMAZON_BEST_SELLERS',platform:'AMAZON',externalId:'FAST',title:'Fast',sourceRank:20,reviewCount:160,observedAt:'2026-08-24T00:00:00Z'},
    {sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',externalId:'SLOW',title:'Slow',sourceRank:5,reviewCount:100,observedAt:'2026-08-20T00:00:00Z'},
    {sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',externalId:'SLOW',title:'Slow',sourceRank:20,reviewCount:102,observedAt:'2026-08-24T00:00:00Z'}
  ]).history;
  const out=buildEarlyTrendRadar(history);
  assert.equal(out.eligible,2);
  assert.equal(out.rows[0].identity,'AMAZON:ID:FAST');
  assert.equal(out.rows.at(-1).signal,'COOLING');
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.purchaseAuthorized,false);
});
