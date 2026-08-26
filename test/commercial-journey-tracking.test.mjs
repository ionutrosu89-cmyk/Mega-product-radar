import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('commercial modules emit real page-view journey events',async()=>{
  const discover=await readFile(new URL('../discover.js',import.meta.url),'utf8');
  const radar=await readFile(new URL('../commercial-radar.js',import.meta.url),'utf8');
  const launch=await readFile(new URL('../commercial-launch.js',import.meta.url),'utf8');
  assert.match(discover,/trackJourneyEvent\('DISCOVER_VIEW'/);
  assert.match(radar,/trackJourneyEvent\('OPPORTUNITIES_VIEW'/);
  assert.match(radar,/trackJourneyEvent\('OPPORTUNITY_WORK_ACTION'/);
  assert.match(launch,/trackJourneyEvent\('LAUNCH_VIEW'/);
});

test('checkout tracking happens only after Stripe returns a checkout URL',async()=>{
  const checkout=await readFile(new URL('../netlify/functions/billing-checkout.mjs',import.meta.url),'utf8');
  const stripeSuccess=checkout.indexOf("if(!stripeResponse.ok||!stripe?.url)");
  const tracked=checkout.indexOf("eventName:'CHECKOUT_STARTED'");
  assert.ok(stripeSuccess>=0&&tracked>stripeSuccess);
});

test('Stripe webhook owns completed checkout and active subscription signals',async()=>{
  const webhook=await readFile(new URL('../netlify/functions/billing-webhook.mjs',import.meta.url),'utf8');
  assert.match(webhook,/CHECKOUT_COMPLETED/);
  assert.match(webhook,/SUBSCRIPTION_ACTIVATED/);
  assert.match(webhook,/checkout\.session\.completed/);
  assert.match(webhook,/customer\.subscription\.created/);
});

test('analytics admin registry is server-only and has no authenticated browser policy',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260822_beta_analytics_admins.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on table public\.beta_analytics_admins from anon, authenticated/i);
  assert.doesNotMatch(sql,/create policy/i);
});
