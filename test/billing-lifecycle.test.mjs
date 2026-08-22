import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {grantedPlan,subscriptionPeriodEnd,planChangeDirection} from '../netlify/functions/billing-webhook.mjs';
import {createBillingChangePlanHandler} from '../netlify/functions/billing-change-plan.mjs';
import {createBillingCancelHandler} from '../netlify/functions/billing-cancel.mjs';

test('paid entitlement is granted only for active or trialing subscriptions',()=>{
  assert.equal(grantedPlan({status:'active',metadata:{plan:'RADAR'}}),'RADAR');
  assert.equal(grantedPlan({status:'trialing',metadata:{plan:'LAUNCH'}}),'LAUNCH');
  assert.equal(grantedPlan({status:'past_due',metadata:{plan:'LAUNCH'}}),'FREE');
  assert.equal(grantedPlan({status:'unpaid',metadata:{plan:'RADAR'}}),'FREE');
  assert.equal(grantedPlan({status:'canceled',metadata:{plan:'DISCOVER'}}),'FREE');
});

test('subscription period end supports legacy and Stripe Basil item-level periods',()=>{
  assert.equal(subscriptionPeriodEnd({current_period_end:1780000000}),1780000000);
  assert.equal(subscriptionPeriodEnd({items:{data:[{current_period_end:1781000000}]}}),1781000000);
  assert.equal(subscriptionPeriodEnd({items:{data:[{current_period_end:1781000000},{current_period_end:1782000000}]}}),1782000000);
  assert.equal(subscriptionPeriodEnd({items:{data:[]}}),null);
});

test('plan change direction distinguishes upgrades, downgrades and no-op updates',()=>{
  assert.equal(planChangeDirection('RADAR','LAUNCH'),'UPGRADE');
  assert.equal(planChangeDirection('LAUNCH','DISCOVER'),'DOWNGRADE');
  assert.equal(planChangeDirection('RADAR','RADAR'),'UNCHANGED');
});

test('plan change and cancellation remain disabled until Stripe is configured',async()=>{
  const change=createBillingChangePlanHandler({env:{},fetch:async()=>new Response(null,{status:500})});
  const cancel=createBillingCancelHandler({env:{},fetch:async()=>new Response(null,{status:500})});
  assert.equal((await change(new Request('https://radar.example/api/billing/change-plan',{method:'POST'}))).status,503);
  assert.equal((await cancel(new Request('https://radar.example/api/billing/cancel',{method:'POST'}))).status,503);
});

test('checkout prevents duplicate active Stripe subscriptions and client routes to change-plan',async()=>{
  const checkout=await readFile(new URL('../netlify/functions/billing-checkout.mjs',import.meta.url),'utf8');
  const client=await readFile(new URL('../billing-client.js',import.meta.url),'utf8');
  assert.match(checkout,/ACTIVE_SUBSCRIPTION_EXISTS/);
  assert.match(checkout,/provider_subscription_id/);
  assert.match(client,/\/api\/billing\/change-plan/);
});

test('checkout completion cannot overwrite subscription lifecycle state',async()=>{
  const webhook=await readFile(new URL('../netlify/functions/billing-webhook.mjs',import.meta.url),'utf8');
  const checkoutSection=webhook.split('async function applyCheckoutSession')[1].split('export function createBillingWebhookHandler')[0];
  assert.match(checkoutSection,/Subscription lifecycle events are the/);
  assert.doesNotMatch(checkoutSection,/subscriptions\?on_conflict/);
  assert.doesNotMatch(checkoutSection,/status:'checkout_completed'/);
});

test('subscription updates track PLAN_CHANGED only when the paid plan really changes',async()=>{
  const webhook=await readFile(new URL('../netlify/functions/billing-webhook.mjs',import.meta.url),'utf8');
  assert.match(webhook,/eventType==='customer\.subscription\.created'.*SUBSCRIPTION_ACTIVATED/s);
  assert.match(webhook,/eventType==='customer\.subscription\.updated'.*previousPlan!==plan.*PLAN_CHANGED/s);
  assert.match(webhook,/previousPlan,newPlan:plan,direction:planChangeDirection/);
});

test('billing lifecycle migration stores cancel-at-period-end state',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260820_billing_lifecycle.sql',import.meta.url),'utf8');
  assert.match(sql,/cancel_at_period_end boolean not null default false/);
});
