import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import {createBillingCheckoutHandler} from '../netlify/functions/billing-checkout.mjs';
import {createBillingWebhookHandler,verifySignature} from '../netlify/functions/billing-webhook.mjs';

test('checkout remains disabled until Stripe secret is configured',async()=>{
  const handler=createBillingCheckoutHandler({env:{},fetch:async()=>new Response(null,{status:500})});
  const response=await handler(new Request('https://radar.example/api/billing/checkout',{method:'POST'}));
  assert.equal(response.status,503);
});

test('webhook remains disabled until secrets are configured',async()=>{
  const handler=createBillingWebhookHandler({env:{},fetch:async()=>new Response(null,{status:500})});
  const response=await handler(new Request('https://radar.example/api/billing/webhook',{method:'POST',body:'{}'}));
  assert.equal(response.status,503);
});

test('Stripe webhook signature verifier accepts a fresh valid signature and rejects a wrong one',()=>{
  const secret='whsec_test_only';
  const raw=JSON.stringify({id:'evt_test',type:'checkout.session.completed'});
  const timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac('sha256',secret).update(`${timestamp}.${raw}`,'utf8').digest('hex');
  assert.equal(verifySignature(raw,`t=${timestamp},v1=${signature}`,secret),true);
  assert.equal(verifySignature(raw,`t=${timestamp},v1=0000`,secret),false);
});

test('checkout source only accepts the three paid commercial plans',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../netlify/functions/billing-checkout.mjs',import.meta.url),'utf8'));
  assert.match(source,/DISCOVER:'STRIPE_PRICE_DISCOVER'/);
  assert.match(source,/RADAR:'STRIPE_PRICE_RADAR'/);
  assert.match(source,/LAUNCH:'STRIPE_PRICE_LAUNCH'/);
  assert.doesNotMatch(source,/FREE:'STRIPE_PRICE_FREE'/);
});
