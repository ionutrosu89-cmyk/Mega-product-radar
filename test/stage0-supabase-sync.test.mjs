import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 Supabase sync uses GitHub OIDC and never embeds service-role credentials',async()=>{
  const script=await fs.readFile('scripts/stage0-supabase-sync.mjs','utf8');
  assert.match(script,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(script,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(script,/mega-product-radar-supabase/);
  assert.equal(script.includes('SUPABASE_SERVICE_ROLE_KEY'),false);
  assert.equal(script.includes('DATAFORSEO_LOGIN'),false);
  assert.equal(script.includes('DATAFORSEO_PASSWORD'),false);
});

test('Stage 0 Supabase sync workflow is post-scan, OIDC-enabled and cannot execute paid providers',async()=>{
  const workflow=await fs.readFile('.github/workflows/stage0-supabase-sync.yml','utf8');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/Mega Product Radar Scan/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/stage0-supabase-sync\.mjs/);
  assert.equal(workflow.includes('dataforseo-keywords.mjs'),false);
  assert.equal(workflow.includes('provider-intelligence-v26.mjs'),false);
  assert.equal(workflow.includes('provider-intelligence-stage0.mjs'),false);
});

test('Stage 0 sync client caps paid evidence and full catalogue independently',async()=>{
  const script=await fs.readFile('scripts/stage0-supabase-sync.mjs','utf8');
  assert.match(script,/budgetAudit\.targets/);
  assert.match(script,/\.slice\(0,15\)/);
  assert.match(script,/STAGE0_PRODUCT_CAP=100/);
  assert.match(script,/catalogue\.length>=STAGE0_PRODUCT_CAP/);
  assert.match(script,/\['PROMISING','VALIDATE'\]/);
  assert.match(script,/providerVerified/);
  assert.match(script,/readyForTestDemandGate/);
});

test('Stage 0 V3 catalogue sync never creates FINALIST TEST or BUY states client-side',async()=>{
  const script=await fs.readFile('scripts/stage0-supabase-sync.mjs','utf8');
  assert.match(script,/function safeStage/);
  assert.match(script,/\['PROMISING','VALIDATE'\]/);
  assert.match(script,/'DISCOVERED'/);
  assert.equal(script.includes("return 'FINALIST'"),false);
  assert.equal(script.includes("return 'TEST_READY'"),false);
  assert.equal(script.includes("return 'BUY_READY'"),false);
  assert.match(script,/PIPELINE_SNAPSHOT/);
  assert.match(script,/mpr_existing_pipeline/);
});
