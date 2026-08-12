import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterPurchaseFlow, discoveryEconomics, discoveryQuality, discoveryScore, suggestedDiscoveryStage } from '../discovery-engine.js';

test('discovery quality requires five checks and foreign presence',()=>{
  assert.equal(discoveryQuality({checks:5,foreignPresence:1}).level,'LIVE');
  assert.equal(discoveryQuality({checks:4,foreignPresence:2}).level,'PARTIAL');
  assert.equal(discoveryQuality({checks:8,foreignPresence:0}).level,'PARTIAL');
});

test('discovery economics includes VAT, marketplace, ads and returns reserve',()=>{
  const e=discoveryEconomics({sellTarget:200,landedEstimate:50});
  assert.ok(e.profit>0);
  assert.ok(e.margin>0);
  assert.ok(e.roi>0);
});

test('PARTIAL candidate cannot jump to TEST or BUY candidate automatically',()=>{
  const p={sellTarget:300,landedEstimate:50,checks:3,foreignPresence:3,chinaPresence:2,foreignResults:20,chinaResults:12,romaniaResults:0,socialResults:20};
  assert.equal(suggestedDiscoveryStage(p),'NEW');
});

test('strong LIVE candidate can become BUY CANDIDATE but not purchase-flow ready without user stage',()=>{
  const p={sellTarget:329,landedEstimate:60,checks:8,foreignPresence:3,chinaPresence:2,romaniaPresence:0,foreignResults:24,chinaResults:16,romaniaResults:0,socialResults:22,cat:'Travel'};
  const a=discoveryScore(p);
  assert.ok(a.score>=84);
  assert.equal(suggestedDiscoveryStage(p),'BUY CANDIDATE');
  assert.equal(canEnterPurchaseFlow(p,{stage:'NEW'}),false);
  assert.equal(canEnterPurchaseFlow(p,{stage:'BUY CANDIDATE'}),true);
});

test('kids candidate cannot enter purchase flow without kidsGate PASS',()=>{
  const base={sellTarget:329,landedEstimate:60,checks:8,foreignPresence:3,chinaPresence:2,romaniaPresence:0,foreignResults:24,chinaResults:16,romaniaResults:0,socialResults:22,cat:'Kids 3–6 • Travel'};
  assert.notEqual(suggestedDiscoveryStage(base),'BUY CANDIDATE');
  assert.equal(canEnterPurchaseFlow(base,{stage:'BUY CANDIDATE'}),false);
  assert.equal(canEnterPurchaseFlow({...base,kidsGate:'PASS'},{stage:'BUY CANDIDATE'}),true);
});
