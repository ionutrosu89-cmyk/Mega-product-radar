import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankingTrendHandoff,evaluateScheduledRankingInput,evaluateTrendHandoffEligibility} from '../ranking-live-handoff-v1.js';

const trend=(overrides={})=>({
  schema:'MPR_RANK_TREND_V1',
  historyKey:'AMAZON:US:B001|EXPLICIT_PRODUCT_BEST_SELLERS_RANK|Category',
  sampleCount:2,
  minIntervalMs:3600000,
  firstObservedAt:'2026-08-27T10:00:00Z',
  lastObservedAt:'2026-08-27T11:00:00Z',
  firstRank:100,
  lastRank:90,
  velocityRankPerDay:240,
  accelerationRankPerDay2:null,
  confirmedAcceleration:false,
  status:'IMPROVING',
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  ...overrides
});

const cycle=(overrides={})=>({
  schema:'MPR_RANKING_HISTORY_CYCLE_V1',
  decision:'COMPLETED',
  completedAt:'2026-08-27T12:00:00Z',
  fingerprint:'cycle-fingerprint',
  productionPersistenceVerified:false,
  trends:{trends:[trend()]},
  ...overrides
});

test('comparable fresh trend is analysis eligible',()=>{
  const result=evaluateTrendHandoffEligibility(trend(),{asOf:'2026-08-27T12:00:00Z'});
  assert.equal(result.analysisEligible,true);
  assert.equal(result.decision,'ANALYSIS_ELIGIBLE');
});

test('single-sample or stale trend is held',()=>{
  assert.equal(evaluateTrendHandoffEligibility(trend({sampleCount:1,velocityRankPerDay:null}),{asOf:'2026-08-27T12:00:00Z'}).analysisEligible,false);
  const stale=evaluateTrendHandoffEligibility(trend({lastObservedAt:'2026-08-01T00:00:00Z'}),{asOf:'2026-08-27T12:00:00Z',maxAgeMs:86400000});
  assert.equal(stale.analysisEligible,false);
  assert.ok(stale.reasons.includes('TREND_STALE'));
});

test('truth-class violations are rejected',()=>{
  const result=evaluateTrendHandoffEligibility(trend({verifiedSalesRows:1,salesEvidenceClass:'VERIFIED_SALES'}),{asOf:'2026-08-27T12:00:00Z'});
  assert.equal(result.analysisEligible,false);
  assert.ok(result.reasons.includes('TRUTH_CLASS_VIOLATION'));
});

test('local persistence produces analysis-only handoff and never production records',()=>{
  const handoff=buildRankingTrendHandoff(cycle(),{asOf:'2026-08-27T12:00:00Z'});
  assert.equal(handoff.manifest.handoffStatus,'ANALYSIS_ONLY');
  assert.equal(handoff.analysisRecords.length,1);
  assert.equal(handoff.productionRecords.length,0);
  assert.equal(handoff.manifest.purchaseAuthorized,false);
  assert.equal(handoff.manifest.paidDataCallsTriggered,0);
});

test('production records require verified production persistence from the cycle',()=>{
  const handoff=buildRankingTrendHandoff(cycle({productionPersistenceVerified:true}),{asOf:'2026-08-27T12:00:00Z'});
  assert.equal(handoff.manifest.handoffStatus,'PRODUCTION_READY');
  assert.equal(handoff.productionRecords.length,1);
});

test('incomplete cycle cannot hand off trends',()=>{
  const handoff=buildRankingTrendHandoff(cycle({decision:'SKIPPED'}),{asOf:'2026-08-27T12:00:00Z'});
  assert.equal(handoff.analysisRecords.length,0);
  assert.equal(handoff.productionRecords.length,0);
  assert.equal(handoff.heldRecords.length,1);
  assert.ok(handoff.heldRecords[0].holdReasons.includes('HISTORY_CYCLE_NOT_COMPLETED'));
});

test('scheduler input requires a fresh resolved bundle',()=>{
  const input={generatedAt:'2026-08-27T11:30:00Z',rankingSignalResolution:{manifest:{asOf:'2026-08-27T11:30:00Z'}}};
  const fresh=evaluateScheduledRankingInput(input,{now:'2026-08-27T12:00:00Z'});
  assert.equal(fresh.runnable,true);
  const stale=evaluateScheduledRankingInput(input,{now:'2026-08-27T15:00:00Z',maxInputAgeMs:3600000});
  assert.equal(stale.runnable,false);
  assert.ok(stale.reasons.includes('SCHEDULER_INPUT_STALE'));
});
