import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const workflowPath='.github/workflows/paid-beta-deployment-acceptance.yml';
const oidcHelperPath='scripts/github-actions-readiness-oidc.mjs';

async function workflow(){return readFile(workflowPath,'utf8');}

test('deployment acceptance has a distinct operator-visible job and bounded runtime',async()=>{
  const source=await workflow();
  assert.match(source,/deployment-acceptance:\n\s+name: Paid beta deployment acceptance/);
  assert.match(source,/timeout-minutes: 10/);
  assert.match(source,/group: paid-beta-deployment-acceptance-/);
});

test('manual acceptance may supply a public HTTPS base URL without storing it as a secret',async()=>{
  const source=await workflow();
  assert.match(source,/base_url:\n\s+description: HTTPS deployment URL/);
  assert.match(source,/inputs\.base_url \|\| vars\.MPR_BASE_URL/);
  assert.match(source,/Deployment target must use HTTPS/);
});

test('readiness authentication uses short-lived GitHub OIDC rather than a persistent repository secret',async()=>{
  const source=await workflow();
  const helper=await readFile(oidcHelperPath,'utf8');
  assert.match(source,/permissions:\n\s+contents: read\n\s+id-token: write/);
  assert.match(source,/Mint short-lived readiness credential/);
  assert.match(source,/node scripts\/github-actions-readiness-oidc\.mjs/);
  assert.doesNotMatch(source,/secrets\.MPR_READINESS_PROBE_TOKEN/);
  assert.match(helper,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(helper,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(helper,/audience='mega-product-radar-readiness'/);
  assert.match(helper,/::add-mask::/);
  assert.match(helper,/MPR_READINESS_PROBE_TOKEN=/);
  assert.doesNotMatch(helper,/console\.log\([^\n]*MPR_READINESS_PROBE_TOKEN/);
});

test('missing deployment URL still fails closed before protected checks run',async()=>{
  const source=await workflow();
  assert.match(source,/BLOCKED_CONFIGURATION: deployment URL is missing/);
  assert.match(source,/exit 1/);
});

test('sandbox workspace identity is resolved server-side instead of supplied to GitHub Actions',async()=>{
  const source=await workflow();
  assert.doesNotMatch(source,/sandbox_workspace_id|MPR_SANDBOX_WORKSPACE_ID/);
  assert.match(source,/Dedicated sandbox workspace is resolved server-side/);
});

test('workflow distinguishes public site reachability from protected readiness diagnostics',async()=>{
  const source=await workflow();
  assert.match(source,/curl --fail --silent --show-error --location --max-time 15/);
  assert.match(source,/beta\.html/);
  assert.match(source,/SITE_UNREACHABLE/);
  assert.match(source,/npm run verify:paid-beta-deployment/);
});

test('dependency install is locked and lifecycle scripts are disabled in acceptance runner',async()=>{
  const source=await workflow();
  assert.match(source,/npm ci --ignore-scripts --no-fund/);
});
