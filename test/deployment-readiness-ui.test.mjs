import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('release readiness dashboard never asks the browser for secret legal or sandbox identity values',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(html,/Release Readiness/);
  assert.match(html,/nu expune valori secrete, date juridice complete sau date de client/i);
  assert.doesNotMatch(html,/type=["']password["']/i);
  assert.match(js,/\/api\/internal\/billing-readiness/);
  assert.match(js,/\/api\/internal\/paid-beta-runtime-readiness/);
  assert.match(js,/\/api\/internal\/sandbox-preflight-readiness/);
  assert.match(js,/\/api\/internal\/billing-e2e-acceptance/);
  assert.match(js,/\/api\/internal\/legal-readiness/);
  assert.doesNotMatch(js,/MPR_SANDBOX_WORKSPACE_ID|x-mpr-workspace-id/);
  assert.doesNotMatch(js,/localStorage.*STRIPE/i);
  assert.doesNotMatch(js,/localStorage.*LEGAL_/i);
});

test('release readiness uses authenticated admin diagnostics and preserves no-go by default',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(js,/getCurrentSession/);
  assert.match(js,/authorization:`Bearer \$\{session\.access_token\}`/);
  assert.match(js,/setText\('#liveVerdict',state\.liveBillingLabel,state\.liveBillingReady\?'ok':'bad'/);
  assert.match(js,/setText\('#runtimeVerdict',data\.ready\?'READY':'NO-GO'/);
  assert.match(js,/setText\('#sandboxWorkspaceVerdict',data\.ready\?'CLEAN':'BLOCKED'/);
  assert.match(js,/setText\('#e2eVerdict',go\?'GO':`\$\{count\}\/6`/);
  assert.match(js,/setText\('#legalVerdict',data\.ready\?'READY':'NO-GO'/);
  assert.match(js,/const sandboxReady=Boolean\(billingState\.sandboxReady&&runtime\.ready&&sandbox\.ready\)/);
  assert.match(js,/const prereqsReady=Boolean\(billingState\.liveBillingReady&&runtime\.ready&&legal\.ready\)/);
  assert.match(html,/id="sandboxVerdict">NO-GO/);
  assert.match(html,/id="sandboxWorkspaceVerdict">BLOCKED/);
  assert.match(html,/id="e2eVerdict">NO-GO/);
  assert.match(html,/id="liveVerdict">NO-GO/);
  assert.match(html,/id="runtimeVerdict">NO-GO/);
  assert.match(html,/id="legalVerdict">NO-GO/);
  assert.match(html,/id="prereqVerdict">BLOCKED/);
});

test('billing E2E card exposes progress only and keeps deployment identity server-side',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(html,/Billing E2E — current deployment/);
  assert.match(html,/Un GO vechi de pe alt deploy nu este reutilizat/);
  assert.match(js,/Observed checkpoints/);
  assert.match(js,/Next verified stage/);
  assert.match(js,/Server verdict/);
  assert.doesNotMatch(js,/deploymentRef|COMMIT_REF|DEPLOY_ID/);
});

test('interactive guide lists every required Stripe and Supabase variable',async()=>{
  const js=await readFile('deployment-readiness.js','utf8');
  for(const key of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_DISCOVER','STRIPE_PRICE_RADAR','STRIPE_PRICE_LAUNCH','SUPABASE_SERVICE_ROLE_KEY'])assert.match(js,new RegExp(key));
});

test('interactive guide retains exact commercial targets and requires database sandbox and billing E2E runtime',async()=>{
  const html=await readFile('deployment-readiness.html','utf8');
  const js=await readFile('deployment-readiness.js','utf8');
  assert.match(js,/Discover · €17,90/);
  assert.match(js,/Radar · €29/);
  assert.match(js,/Launch · €89/);
  assert.match(html,/Paid Beta database runtime/);
  assert.match(html,/Sandbox workspace preflight/);
  assert.match(html,/Billing E2E — current deployment/);
  assert.match(html,/Legal P0/);
  assert.match(html,/Public Commercial GO/);
  assert.match(html,/migrare Supabase lipsă/);
});
