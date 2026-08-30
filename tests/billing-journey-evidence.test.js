import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyBillingJourneyEvidence} from '../scripts/verify-billing-journey-evidence.mjs';

function validEvidence(){
  const workspaceId='workspace-test-1';
  const providerSubscriptionId='sub_test_same';
  return {
    schema:'MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1',
    environment:'SANDBOX',
    workspaceId,
    checkout:{mode:'SUBSCRIPTION',currency:'EUR',realMoney:false},
    checkpoints:[
      {stage:'FREE_BASELINE',workspaceId,workspacePlan:'FREE',subscriptionStatus:'none',providerSubscriptionId:'',activeSubscriptionCount:0,cancelAtPeriodEnd:false,lastStripeEventId:'',observedAt:'2026-08-30T10:00:00Z'},
      {stage:'DISCOVER_ACTIVE',workspaceId,workspacePlan:'DISCOVER',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:false,lastStripeEventId:'evt_discover',observedAt:'2026-08-30T10:05:00Z'},
      {stage:'RADAR_ACTIVE',workspaceId,workspacePlan:'RADAR',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:false,lastStripeEventId:'evt_radar',observedAt:'2026-08-30T10:10:00Z'},
      {stage:'LAUNCH_ACTIVE',workspaceId,workspacePlan:'LAUNCH',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:false,lastStripeEventId:'evt_launch',observedAt:'2026-08-30T10:15:00Z'},
      {stage:'CANCEL_SCHEDULED',workspaceId,workspacePlan:'LAUNCH',subscriptionStatus:'active',providerSubscriptionId,activeSubscriptionCount:1,cancelAtPeriodEnd:true,lastStripeEventId:'evt_cancel',observedAt:'2026-08-30T10:20:00Z'},
      {stage:'ENDED_FREE',workspaceId,workspacePlan:'FREE',subscriptionStatus:'canceled',providerSubscriptionId,activeSubscriptionCount:0,cancelAtPeriodEnd:false,lastStripeEventId:'evt_ended',observedAt:'2026-08-30T10:25:00Z'}
    ]
  };
}

test('complete sandbox journey with one Stripe subscription can pass',()=>{
  const result=verifyBillingJourneyEvidence(validEvidence());
  assert.equal(result.ok,true);
  assert.equal(result.verdict,'GO');
  assert.equal(result.checks.oneSubscriptionAcrossPaidJourney,true);
});

test('a duplicate Stripe subscription during upgrade fails closed',()=>{
  const evidence=validEvidence();
  evidence.checkpoints.find(row=>row.stage==='RADAR_ACTIVE').providerSubscriptionId='sub_duplicate';
  const result=verifyBillingJourneyEvidence(evidence);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('SUBSCRIPTION_ID_CHANGED:RADAR_ACTIVE'));
});

test('paid checkpoint without webhook-verified active state cannot pass',()=>{
  const evidence=validEvidence();
  const row=evidence.checkpoints.find(item=>item.stage==='LAUNCH_ACTIVE');
  row.workspacePlan='RADAR';
  row.subscriptionStatus='past_due';
  const result=verifyBillingJourneyEvidence(evidence);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('PLAN_MISMATCH:LAUNCH_ACTIVE'));
  assert.ok(result.errors.includes('PAID_STATUS_NOT_ACTIVE:LAUNCH_ACTIVE'));
});

test('scheduled cancellation must retain active Launch entitlement until terminal event',()=>{
  const evidence=validEvidence();
  evidence.checkpoints.find(row=>row.stage==='CANCEL_SCHEDULED').workspacePlan='FREE';
  const result=verifyBillingJourneyEvidence(evidence);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('PLAN_MISMATCH:CANCEL_SCHEDULED'));
});

test('ended checkpoint requires FREE and zero active subscriptions',()=>{
  const evidence=validEvidence();
  const ended=evidence.checkpoints.find(row=>row.stage==='ENDED_FREE');
  ended.workspacePlan='LAUNCH';
  ended.activeSubscriptionCount=1;
  const result=verifyBillingJourneyEvidence(evidence);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('ENDED_NOT_FREE'));
  assert.ok(result.errors.includes('ENDED_ACTIVE_SUBSCRIPTION_REMAINS'));
});

test('real-money or non-sandbox evidence is rejected by this acceptance gate',()=>{
  const evidence=validEvidence();
  evidence.environment='LIVE';
  evidence.checkout.realMoney=true;
  const result=verifyBillingJourneyEvidence(evidence);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('NOT_SANDBOX_EVIDENCE'));
  assert.ok(result.errors.includes('REAL_MONEY_EVIDENCE_REJECTED'));
});

test('reused lifecycle event id cannot masquerade as multiple verified transitions',()=>{
  const evidence=validEvidence();
  evidence.checkpoints.find(row=>row.stage==='RADAR_ACTIVE').lastStripeEventId='evt_discover';
  const result=verifyBillingJourneyEvidence(evidence);
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('WEBHOOK_EVENT_REUSED:RADAR_ACTIVE'));
});
