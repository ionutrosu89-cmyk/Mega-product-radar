import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('deployment readiness dashboard never asks the browser for secret values',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(html,/Deployment Readiness/);
  assert.match(html,/Nu salva secretele în GitHub/);
  assert.doesNotMatch(html,/type=["']password["']/i);
  assert.match(js,/\/api\/internal\/billing-readiness/);
  assert.doesNotMatch(js,/localStorage.*STRIPE/i);
});

test('deployment readiness uses authenticated admin diagnostics and preserves no-go by default',async()=>{
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(js,/getCurrentSession/);
  assert.match(js,/authorization:`Bearer \$\{session\.access_token\}`/);
  assert.match(js,/setText\('#verdict',data\.ready\?'GO':'NO-GO'/);
});

test('interactive guide lists every required Stripe and Supabase variable',async()=>{
  const js=await readFile('deployment-readiness.js','utf8');
  for(const key of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_DISCOVER','STRIPE_PRICE_RADAR','STRIPE_PRICE_LAUNCH','SUPABASE_SERVICE_ROLE_KEY'])assert.match(js,new RegExp(key));
});

test('interactive guide retains exact commercial price targets and legal release gate',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  assert.match(html,/Discover €17,90/);
  assert.match(html,/Radar €29/);
  assert.match(html,/Launch €89/);
  assert.match(html,/P0 juridic/);
  assert.match(html,/FREE → Discover → Radar → Launch → anulare/);
});
