import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {grantedPlan,planChangeDirection} from '../netlify/functions/billing-webhook.mjs';
import {stripeEventOrderDecision} from '../billing-webhook-ordering.js';

const PAID_PLANS=['DISCOVER','RADAR','LAUNCH'];
const NON_ENTITLED_STATUSES=['past_due','unpaid','canceled','incomplete','incomplete_expired','paused','unknown'];

test('active and trialing Stripe lifecycle events are the only states that grant paid entitlement',()=>{
  for(const plan of PAID_PLANS){
    for(const status of ['active','trialing']){
      assert.equal(grantedPlan({status,metadata:{plan}}),plan,`${plan}/${status} must stay entitled`);
    }
    for(const status of NON_ENTITLED_STATUSES){
      assert.equal(grantedPlan({status,metadata:{plan}}),'FREE',`${plan}/${status} must fail closed to FREE`);
    }
  }
});

test('cancel at period end preserves entitlement only while Stripe still reports active or trialing',()=>{
  assert.equal(grantedPlan({status:'active',cancel_at_period_end:true,metadata:{plan:'RADAR'}}),'RADAR');
  assert.equal(grantedPlan({status:'trialing',cancel_at_period_end:true,metadata:{plan:'LAUNCH'}}),'LAUNCH');
  assert.equal(grantedPlan({status:'canceled',cancel_at_period_end:false,metadata:{plan:'LAUNCH'}}),'FREE');
});

test('invalid or missing Stripe plan metadata never grants paid access',()=>{
  for(const plan of ['',undefined,'FREE','ENTERPRISE','launch-plus']){
    assert.equal(grantedPlan({status:'active',metadata:{plan}}),'FREE');
  }
});

test('same-second ambiguous lifecycle ordering can revoke or retain but never grant or upgrade paid entitlement',()=>{
  const base={storedCreated:100,incomingCreated:100,storedEventId:'evt_old',incomingEventId:'evt_new'};
  assert.deepEqual(stripeEventOrderDecision({...base,storedPlan:'FREE',storedStatus:'canceled',incomingPlan:'DISCOVER',incomingStatus:'active'}),{apply:false,reason:'AMBIGUOUS_WOULD_GRANT'});
  assert.deepEqual(stripeEventOrderDecision({...base,storedPlan:'DISCOVER',storedStatus:'active',incomingPlan:'LAUNCH',incomingStatus:'active'}),{apply:false,reason:'AMBIGUOUS_WOULD_UPGRADE'});
  assert.deepEqual(stripeEventOrderDecision({...base,storedPlan:'LAUNCH',storedStatus:'active',incomingPlan:'FREE',incomingStatus:'past_due'}),{apply:true,reason:'AMBIGUOUS_FAIL_CLOSED'});
});

test('plan-change direction covers the commercial ladder without changing entitlement authority',()=>{
  assert.equal(planChangeDirection('FREE','DISCOVER'),'UPGRADE');
  assert.equal(planChangeDirection('DISCOVER','RADAR'),'UPGRADE');
  assert.equal(planChangeDirection('RADAR','LAUNCH'),'UPGRADE');
  assert.equal(planChangeDirection('LAUNCH','RADAR'),'DOWNGRADE');
  assert.equal(planChangeDirection('RADAR','DISCOVER'),'DOWNGRADE');
  assert.equal(planChangeDirection('DISCOVER','DISCOVER'),'UNCHANGED');
});

test('existing-subscription mutations never create a second Stripe subscription',async()=>{
  const [changePlan,cancel,resume]=await Promise.all([
    readFile('netlify/functions/billing-change-plan.mjs','utf8'),
    readFile('netlify/functions/billing-cancel.mjs','utf8'),
    readFile('netlify/functions/billing-resume.mjs','utf8')
  ]);
  for(const source of [changePlan,cancel,resume]){
    assert.match(source,/\/v1\/subscriptions\/\$\{encodeURIComponent\(sub\.provider_subscription_id\)\}/);
    assert.doesNotMatch(source,/fetchImpl\(`https:\/\/api\.stripe\.com\/v1\/subscriptions`,\{method:'POST'/);
  }
});
