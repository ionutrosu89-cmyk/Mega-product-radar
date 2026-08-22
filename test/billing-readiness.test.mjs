import assert from 'node:assert/strict';
import test from 'node:test';
import {createBillingReadinessHandler,stripeMode} from '../netlify/functions/billing-readiness.mjs';

function fakeFetch(url){
  if(String(url).includes('/auth/v1/user'))return Promise.resolve(Response.json({email:'admin@example.com'}));
  if(String(url).includes('/v1/prices/price_discover'))return Promise.resolve(Response.json({active:true,currency:'eur',unit_amount:1790,recurring:{interval:'month'}}));
  if(String(url).includes('/v1/prices/price_radar'))return Promise.resolve(Response.json({active:true,currency:'eur',unit_amount:2900,recurring:{interval:'month'}}));
  if(String(url).includes('/v1/prices/price_launch'))return Promise.resolve(Response.json({active:true,currency:'eur',unit_amount:8900,recurring:{interval:'month'}}));
  return Promise.resolve(new Response('{}',{status:404,headers:{'content-type':'application/json'}}));
}

const baseEnv={SUPABASE_ANON_KEY:'anon',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.com',STRIPE_WEBHOOK_SECRET:'whsec_test',STRIPE_PRICE_DISCOVER:'price_discover',STRIPE_PRICE_RADAR:'price_radar',STRIPE_PRICE_LAUNCH:'price_launch',SUPABASE_SERVICE_ROLE_KEY:'service'};

test('billing readiness rejects unauthenticated access',async()=>{
  const handler=createBillingReadinessHandler({env:{},fetch:fakeFetch});
  const response=await handler(new Request('https://radar.example/api/internal/billing-readiness'));
  assert.equal(response.status,401);
});

test('billing readiness requires admin allowlist',async()=>{
  const handler=createBillingReadinessHandler({env:{SUPABASE_ANON_KEY:'anon'},fetch:fakeFetch});
  const response=await handler(new Request('https://radar.example/api/internal/billing-readiness',{headers:{authorization:'Bearer token'}}));
  assert.equal(response.status,503);
});

test('billing readiness validates exact EUR monthly price configuration but keeps sandbox blocked for public launch',async()=>{
  const env={...baseEnv,STRIPE_SECRET_KEY:'sk_test_only'};
  const handler=createBillingReadinessHandler({env,fetch:fakeFetch});
  const response=await handler(new Request('https://radar.example/api/internal/billing-readiness',{headers:{authorization:'Bearer token'}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ready,true);
  assert.equal(body.stripeMode,'SANDBOX');
  assert.equal(body.publicLaunchBillingReady,false);
  assert.equal(body.checks.amountsMatch,true);
  assert.equal(body.prices.STRIPE_PRICE_DISCOVER.unitAmount,1790);
  assert.equal(JSON.stringify(body).includes('sk_test_only'),false);
});

test('live Stripe mode can satisfy public launch billing readiness without returning the secret',async()=>{
  const env={...baseEnv,STRIPE_SECRET_KEY:'sk_live_secret'};
  const handler=createBillingReadinessHandler({env,fetch:fakeFetch});
  const response=await handler(new Request('https://radar.example/api/internal/billing-readiness',{headers:{authorization:'Bearer token'}}));
  const body=await response.json();
  assert.equal(body.ready,true);
  assert.equal(body.stripeMode,'LIVE');
  assert.equal(body.publicLaunchBillingReady,true);
  assert.equal(JSON.stringify(body).includes('sk_live_secret'),false);
});

test('stripe mode is conservative for unknown and unconfigured secrets',()=>{
  assert.equal(stripeMode('sk_test_x'),'SANDBOX');
  assert.equal(stripeMode('sk_live_x'),'LIVE');
  assert.equal(stripeMode('other'),'UNKNOWN');
  assert.equal(stripeMode(''),'UNCONFIGURED');
});
