import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const workflowPath='.github/workflows/paid-beta-deployment-acceptance.yml';

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

test('probe credential remains a GitHub secret and missing configuration fails closed',async()=>{
  const source=await workflow();
  assert.match(source,/MPR_READINESS_PROBE_TOKEN: \$\{\{ secrets\.MPR_READINESS_PROBE_TOKEN \}\}/);
  assert.match(source,/BLOCKED_CONFIGURATION: repository secret MPR_READINESS_PROBE_TOKEN is missing/);
  assert.match(source,/exit 1/);
  assert.doesNotMatch(source,/echo[^\n]*MPR_READINESS_PROBE_TOKEN/);
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
