import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRadarAlertFeed,alertKeys} from '../radar-alert-feed-v1.js';

test('breakout candidate creates critical explainable alert',()=>{
  const f=buildRadarAlertFeed([{productKey:'p1',title:'Produs 1',tier:'BREAKOUT_CANDIDATE',marketOpportunityScore:88}]);
  assert.equal(f.alerts[0].type,'BREAKOUT_CANDIDATE');
  assert.equal(f.alerts[0].priority,'CRITICAL');
  assert.equal(f.purchaseAuthorized,false);
  assert.equal(f.externalNotificationsSent,0);
});

test('trend and Romania Gap alerts can coexist for one product without duplicate type',()=>{
  const f=buildRadarAlertFeed([{productKey:'p1',title:'Produs 1',signal:'NEW_AND_ACCELERATING',marketOpportunityScore:82,romaniaGapScore:86}]);
  assert.equal(f.alerts.filter(x=>x.productKey==='p1').length,2);
  assert.ok(f.alerts.some(x=>x.type==='NEW_AND_ACCELERATING'));
  assert.ok(f.alerts.some(x=>x.type==='ROMANIA_GAP_VERY_HIGH'));
});

test('previous alert keys are marked not new to avoid notification spam',()=>{
  const first=buildRadarAlertFeed([{productKey:'p1',tier:'HIGH_OPPORTUNITY',marketOpportunityScore:72}]);
  const second=buildRadarAlertFeed([{productKey:'p1',tier:'HIGH_OPPORTUNITY',marketOpportunityScore:74}],{previousAlertKeys:alertKeys(first)});
  assert.equal(second.alerts[0].isNew,false);
  assert.equal(second.newCount,0);
});

test('cooling is surfaced as review signal, never as purchase instruction',()=>{
  const f=buildRadarAlertFeed([{productKey:'p2',signal:'COOLING',trendScore:45}]);
  assert.equal(f.alerts[0].type,'COOLING');
  assert.equal(f.alerts[0].action,'REVIEW_WATCHLIST');
  assert.equal(f.purchaseAuthorized,false);
});

test('feed prioritizes critical before high and caps returned alerts',()=>{
  const f=buildRadarAlertFeed([
    {productKey:'a',tier:'HIGH_OPPORTUNITY',marketOpportunityScore:70},
    {productKey:'b',tier:'BREAKOUT_CANDIDATE',marketOpportunityScore:85},
    {productKey:'c',signal:'RISING_FAST',trendScore:60}
  ],{maxAlerts:2});
  assert.equal(f.returned,2);
  assert.equal(f.alerts[0].productKey,'b');
  assert.equal(f.paidCallsTriggered,0);
});
