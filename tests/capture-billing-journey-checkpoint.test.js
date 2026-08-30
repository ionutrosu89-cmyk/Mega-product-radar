import assert from 'node:assert/strict';
import test from 'node:test';
import {appendBillingCheckpoint} from '../scripts/capture-billing-journey-checkpoint.mjs';

function checkpoint(overrides={}){
  return {schema:'MPR_STRIPE_SANDBOX_JOURNEY_CHECKPOINT_V1',environment:'SANDBOX',workspaceId:'workspace-1',workspacePlan:'FREE',subscriptionStatus:'none',providerSubscriptionId:'',activeSubscriptionCount:0,cancelAtPeriodEnd:false,lastStripeEventId:'',observedAt:'2026-08-30T20:00:00Z',source:{workspace:'SUPABASE',subscription:'SUPABASE',activeSubscriptionCount:'STRIPE'},...overrides};
}

test('first capture creates sandbox evidence and strips source metadata',()=>{
  const evidence=appendBillingCheckpoint(null,'FREE_BASELINE',checkpoint());
  assert.equal(evidence.schema,'MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1');
  assert.equal(evidence.checkpoints.length,1);
  assert.equal(evidence.checkpoints[0].stage,'FREE_BASELINE');
  assert.equal('source' in evidence.checkpoints[0],false);
});

test('capture enforces exact lifecycle order',()=>{
  const evidence=appendBillingCheckpoint(null,'FREE_BASELINE',checkpoint());
  assert.throws(()=>appendBillingCheckpoint(evidence,'RADAR_ACTIVE',checkpoint({workspacePlan:'RADAR'})),/Expected checkpoint DISCOVER_ACTIVE/);
});

test('capture rejects a different workspace',()=>{
  const evidence=appendBillingCheckpoint(null,'FREE_BASELINE',checkpoint());
  assert.throws(()=>appendBillingCheckpoint(evidence,'DISCOVER_ACTIVE',checkpoint({workspaceId:'workspace-2',workspacePlan:'DISCOVER',subscriptionStatus:'active',providerSubscriptionId:'sub_1',activeSubscriptionCount:1,lastStripeEventId:'evt_1'})),/workspace does not match/);
});

test('capture accepts the next paid checkpoint on the same workspace',()=>{
  let evidence=appendBillingCheckpoint(null,'FREE_BASELINE',checkpoint());
  evidence=appendBillingCheckpoint(evidence,'DISCOVER_ACTIVE',checkpoint({workspacePlan:'DISCOVER',subscriptionStatus:'active',providerSubscriptionId:'sub_1',activeSubscriptionCount:1,lastStripeEventId:'evt_1',observedAt:'2026-08-30T20:05:00Z'}));
  assert.equal(evidence.checkpoints.length,2);
  assert.equal(evidence.checkpoints[1].stage,'DISCOVER_ACTIVE');
});
