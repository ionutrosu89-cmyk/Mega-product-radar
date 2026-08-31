import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/stripe-sandbox-billing-e2e.yml','utf8');

test('Stripe sandbox E2E workflow is sandbox-only and OIDC-protected',()=>{
  assert.match(workflow,/name: Stripe Sandbox Billing E2E/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/\.billing-e2e-trigger/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/MPR_DEPLOYMENT_GATE: SANDBOX/);
  assert.match(workflow,/github-actions-readiness-oidc\.mjs/);
  assert.match(workflow,/npm run verify:paid-beta-deployment/);
  assert.match(workflow,/ensure-free-baseline\.mjs/);
  assert.match(workflow,/npm run verify:stripe-sandbox-e2e/);
  assert.match(workflow,/cancel-in-progress: false/);
  assert.ok(workflow.indexOf('ensure-free-baseline.mjs')<workflow.indexOf('npm run verify:stripe-sandbox-e2e'));
});

test('Stripe sandbox E2E workflow never consumes live billing or static readiness secrets',()=>{
  assert.doesNotMatch(workflow,/LIVE_PREREQS/);
  assert.doesNotMatch(workflow,/STRIPE_SECRET_KEY/);
  assert.doesNotMatch(workflow,/MPR_READINESS_PROBE_TOKEN:\s*\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow,/sk_live_/);
  assert.match(workflow,/Real-money authority: NONE/);
  assert.match(workflow,/Entitlement authority: WEBHOOK ONLY/);
});
