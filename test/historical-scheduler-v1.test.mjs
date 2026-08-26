import assert from 'node:assert/strict';
import test from 'node:test';
import {buildHistoricalSchedule,nextHistoricalDue} from '../historical-scheduler-v1.js';

const A='11111111-1111-4111-8111-111111111111';
const obs=(at,overrides={})=>({canonicalProductId:A,platform:'AMAZON',externalId:'B00ABC1234',surface:'OFFICE_PRODUCTS',observedAt:at,sourceRank:10,...overrides});

test('24h window becomes due without executing anything',()=>{
  const s=buildHistoricalSchedule([obs('2026-08-26T10:00:00Z')],{now:'2026-08-27T10:01:00Z'});
  const w=s.items.find(x=>x.window==='24H');
  assert.equal(w.status,'DUE');assert.equal(s.dueCount,1);assert.equal(s.automaticExecutionAllowed,false);assert.equal(s.paidCallsTriggered,0);assert.equal(s.purchaseAuthorized,false);
});

test('24h window is satisfied after a second observation at least 24h later',()=>{
  const s=buildHistoricalSchedule([obs('2026-08-26T10:00:00Z'),obs('2026-08-27T10:05:00Z')],{now:'2026-08-27T10:06:00Z'});
  assert.equal(s.items.find(x=>x.window==='24H').status,'WINDOW_SATISFIED');
  assert.equal(s.items.find(x=>x.window==='7D').status,'WAITING');
});

test('same ASIN on different rank surfaces is scheduled independently',()=>{
  const h=[obs('2026-08-26T10:00:00Z'),obs('2026-08-26T10:00:00Z',{surface:'ROUND_RING_BINDERS'})];
  const s=buildHistoricalSchedule(h,{now:'2026-08-27T10:01:00Z'});
  assert.equal(s.seriesCount,2);assert.equal(s.dueItems.filter(x=>x.window==='24H').length,2);
});

test('unbound source observation may be scheduled but is not decision eligible',()=>{
  const s=buildHistoricalSchedule([{platform:'AMAZON',externalId:'X1',surface:'BEST_SELLERS',observedAt:'2026-08-26T10:00:00Z'}],{now:'2026-08-27T10:01:00Z'});
  assert.equal(s.dueItems[0].decisionEligible,false);
});

test('next due is deterministic and does not use product title',()=>{
  const s=buildHistoricalSchedule([obs('2026-08-26T10:00:00Z',{title:'Old title'})],{now:'2026-08-26T11:00:00Z'});
  const next=nextHistoricalDue(s);assert.equal(next.window,'24H');assert.equal(next.dueAt,'2026-08-27T10:00:00.000Z');
});

test('invalid scheduler now fails closed',()=>{
  assert.throws(()=>buildHistoricalSchedule([],{now:'not-a-date'}),e=>e.code==='SCHEDULER_NOW_INVALID');
});
