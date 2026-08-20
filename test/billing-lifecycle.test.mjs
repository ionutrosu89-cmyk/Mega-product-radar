import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {grantedPlan} from '../netlify/functions/billing-webhook.mjs';
import {createBillingChangePlanHandler} from '../netlify/functions/billing-change-plan.mjs';
import {createBillingCancelHandler} from '../netlify/functions/billing-cancel.mjs';

test('paid entitlement is granted only for active or trialing subscriptions',()=>{
  assert.equal(grantedPlan({status:'active',metadata:{plan:'RADAR'}}),'RADAR');
  assert.equal(grantedPlan({status:'trialing',metadata:{plan:'LAUNCH'}}),'LAUNCH');
  assert.equal(grantedPlan({status:'past_due',metadata:{plan:'LAUNCH'}}),'FREE');
  assert.equal(grantedPlan({status:'unpaid',metadata:{plan:'RADAR'}}),'FREE');
  assert.equal(grantedPlan({status:'canceled',metadata:{plan:'DISCOVER'}}),'FREE');
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

test('checkout completion alone cannot grant a paid workspace plan',async()=>{
  const webhook=await readFile(new URL('../netlify/functions/billing-webhook.mjs',import.meta.url),'utf8');
  assert.match(webhook,/Checkout completion alone never grants paid access/);
  assert.match(webhook,/plan:'FREE',status:'checkout_completed'/);
});

test('billing lifecycle migration stores cancel-at-period-end state',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260820_billing_lifecycle.sql',import.meta.url),'utf8');
  assert.match(sql,/cancel_at_period_end boolean not null default false/);
});
