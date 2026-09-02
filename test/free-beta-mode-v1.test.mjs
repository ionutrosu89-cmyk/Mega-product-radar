import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {FREE_BETA_MODE} from '../free-beta-mode.js';
import {paidBillingEnabled,paidProviderCallsEnabled} from '../netlify/functions/_commercial-launch-mode.mjs';
import {createBillingCheckoutHandler} from '../netlify/functions/billing-checkout.mjs';
import {createBillingChangePlanHandler} from '../netlify/functions/billing-change-plan.mjs';
import {createBillingResumeHandler} from '../netlify/functions/billing-resume.mjs';

test('free beta is the public default and paid billing needs an exact server switch',()=>{
  assert.equal(FREE_BETA_MODE.enabled,true);
  assert.equal(FREE_BETA_MODE.paidBillingEnabled,false);
  assert.equal(paidBillingEnabled({}),false);
  assert.equal(paidBillingEnabled({MPR_PAID_BILLING_ENABLED:'yes'}),false);
  assert.equal(paidBillingEnabled({MPR_PAID_BILLING_ENABLED:'true'}),true);
  assert.equal(paidProviderCallsEnabled({}),false);
  assert.equal(paidProviderCallsEnabled({MPR_PAID_PROVIDER_CALLS_ENABLED:'true'}),true);
});

test('all paid subscription mutations stop before auth or Stripe during free beta',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return new Response(null,{status:500});};
  const env={STRIPE_SECRET_KEY:'sk_live_must_not_be_called'};
  const handlers=[
    createBillingCheckoutHandler({env,fetch:fetchImpl}),
    createBillingChangePlanHandler({env,fetch:fetchImpl}),
    createBillingResumeHandler({env,fetch:fetchImpl})
  ];
  for(const handler of handlers){
    const response=await handler(new Request('https://radar.example/api/billing/action',{method:'POST'}));
    assert.equal(response.status,403);
    assert.equal((await response.json()).code,'FREE_BETA_ONLY');
  }
  assert.equal(calls,0);
});

test('scheduled paid/public collection is absent and Radar provider calls fail closed',async()=>{
  const [workflow,trigger,background]=await Promise.all([
    readFile(new URL('../.github/workflows/radar-scan.yml',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/radar-trigger.mjs',import.meta.url),'utf8'),
    readFile(new URL('../netlify/functions/radar-scan-background.mjs',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(workflow,/schedule\s*:/);
  assert.doesNotMatch(workflow,/^\s+push\s*:/m);
  assert.match(trigger,/paidProviderCallsEnabled/);
  assert.match(background,/paidProviderCallsEnabled/);
});

test('public beta and pricing pages promise no card or active subscription',async()=>{
  const [beta,pricing,terms,sources]=await Promise.all([
    readFile(new URL('../beta.html',import.meta.url),'utf8'),
    readFile(new URL('../pricing.html',import.meta.url),'utf8'),
    readFile(new URL('../terms.html',import.meta.url),'utf8'),
    readFile(new URL('../sources.html',import.meta.url),'utf8')
  ]);
  assert.match(beta,/fără card/i);
  assert.match(pricing,/checkout-ul și abonamentele reale sunt oprite/i);
  assert.doesNotMatch(pricing,/billing-client\.js/);
  assert.match(terms,/nu există checkout activ/i);
  assert.match(sources,/fail-closed/i);
});
