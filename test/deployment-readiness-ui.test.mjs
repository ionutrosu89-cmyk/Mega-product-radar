import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('release readiness dashboard never asks the browser for secret or legal values',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(html,/Release Readiness/);
  assert.match(html,/nu expune valori secrete sau date juridice complete/i);
  assert.doesNotMatch(html,/type=["']password["']/i);
  assert.match(js,/\/api\/internal\/billing-readiness/);
  assert.match(js,/\/api\/internal\/legal-readiness/);
  assert.doesNotMatch(js,/localStorage.*STRIPE/i);
  assert.doesNotMatch(js,/localStorage.*LEGAL_/i);
});

test('release readiness uses authenticated admin diagnostics and preserves no-go by default',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(js,/getCurrentSession/);
  assert.match(js,/authorization:`Bearer \$\{session\.access_token\}`/);
  assert.match(js,/setText\('#liveVerdict',state\.liveBillingLabel,state\.liveBillingReady\?'ok':'bad'/);
  assert.match(js,/setText\('#legalVerdict',data\.ready\?'READY':'NO-GO'/);
  assert.match(js,/const prereqsReady=Boolean\(billingState\.liveBillingReady&&legal\.ready\)/);
  assert.match(html,/id="sandboxVerdict">NO-GO/);
  assert.match(html,/id="liveVerdict">NO-GO/);
  assert.match(html,/id="legalVerdict">NO-GO/);
  assert.match(html,/id="prereqVerdict">BLOCKED/);
});

test('interactive guide lists every required Stripe and Supabase variable',async()=>{
  const js=await readFile('deployment-readiness.js','utf8');
  for(const key of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_DISCOVER','STRIPE_PRICE_RADAR','STRIPE_PRICE_LAUNCH','SUPABASE_SERVICE_ROLE_KEY'])assert.match(js,new RegExp(key));
});

test('interactive guide retains exact commercial price targets and legal release gate',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(js,/Discover · €17,90/);
  assert.match(js,/Radar · €29/);
  assert.match(js,/Launch · €89/);
  assert.match(html,/Legal P0/);
  assert.match(html,/Public Commercial GO/);
  assert.match(html,/flux sandbox\/live end-to-end/);
});
