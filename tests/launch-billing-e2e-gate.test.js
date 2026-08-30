import assert from 'node:assert/strict';
import test from 'node:test';
import {launchPassEvidence,REQUIRED_CHECKS,summarize} from '../netlify/functions/launch-readiness.mjs';

function validJourney(){
  const workspaceId='workspace-sandbox';
  const providerSubscriptionId='sub_same';
  return {
    schema:'MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1',environment:'SANDBOX',workspaceId,
    checkout:{mode:'SUBSCRIPTION',currency:'EUR',realMoney:false},
    checkpoints:[
      {stage:'FREE_BASELINE',workspaceId,workspacePlan:'FREE',subscriptionStatus:'none',providerSubscriptionId:'',activeSubscriptionCount:0,cancelAtPeriodEnd:false,lastStripeEventId:'',observedAt:'2026-08-30T10:00:00Z'},
      {stage:'DISCOVER_ACTIVE',workspaceId,workspacePlan:'DISCOVER',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:false,lastStripeEventId:'evt_d',observedAt:'2026-08-30T10:01:00Z'},
      {stage:'RADAR_ACTIVE',workspaceId,workspacePlan:'RADAR',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:false,lastStripeEventId:'evt_r',observedAt:'2026-08-30T10:02:00Z'},
      {stage:'LAUNCH_ACTIVE',workspaceId,workspacePlan:'LAUNCH',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:false,lastStripeEventId:'evt_l',observedAt:'2026-08-30T10:03:00Z'},
      {stage:'CANCEL_SCHEDULED',workspaceId,workspacePlan:'LAUNCH',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:true,lastStripeEventId:'evt_c',observedAt:'2026-08-30T10:04:00Z'},
      {stage:'ENDED_FREE',workspaceId,workspacePlan:'FREE',subscriptionStatus:'canceled',providerSubscriptionId,activeSubscriptionCount:0,cancelAtPeriodEnd:false,lastStripeEventId:'evt_e',observedAt:'2026-08-30T10:05:00Z'}
    ]
  };
}

test('public launch registry now requires BILLING_E2E',()=>{
  assert.ok(REQUIRED_CHECKS.includes('BILLING_E2E'));
  const rows=REQUIRED_CHECKS.filter(code=>code!=='BILLING_E2E').map(check_code=>({check_code,status:'PASS',evidence_note:'verified evidence',verified_at:'2026-08-30T10:00:00Z'}));
  const summary=summarize(rows);
  assert.equal(summary.allManualPassed,false);
  assert.equal(summary.total,8);
  assert.equal(summary.checks.find(row=>row.checkCode==='BILLING_E2E').status,'BLOCKED');
});

test('generic evidence note cannot manually PASS BILLING_E2E',()=>{
  const result=launchPassEvidence('BILLING_E2E',{evidenceNote:'trust me, sandbox passed'});
  assert.equal(result.ok,false);
  assert.equal(result.verdict.verdict,'NO-GO');
});

test('machine-verified complete sandbox journey can produce BILLING_E2E PASS evidence',()=>{
  const result=launchPassEvidence('BILLING_E2E',{billingJourneyEvidence:validJourney()});
  assert.equal(result.ok,true);
  assert.equal(result.verdict.verdict,'GO');
  assert.match(result.note,/MPR_BILLING_JOURNEY_EVIDENCE_VERDICT_V1 GO/);
});

test('duplicate subscription journey cannot produce launch PASS evidence',()=>{
  const journey=validJourney();
  journey.checkpoints.find(row=>row.stage==='RADAR_ACTIVE').providerSubscriptionId='sub_duplicate';
  const result=launchPassEvidence('BILLING_E2E',{billingJourneyEvidence:journey});
  assert.equal(result.ok,false);
  assert.ok(result.verdict.errors.includes('SUBSCRIPTION_ID_CHANGED:RADAR_ACTIVE'));
});

test('real-money evidence is rejected by the public launch billing proof gate',()=>{
  const journey=validJourney();
  journey.checkout.realMoney=true;
  const result=launchPassEvidence('BILLING_E2E',{billingJourneyEvidence:journey});
  assert.equal(result.ok,false);
  assert.ok(result.verdict.errors.includes('REAL_MONEY_EVIDENCE_REJECTED'));
});
