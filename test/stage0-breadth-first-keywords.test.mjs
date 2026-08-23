import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 gives broad keyword coverage before deep variants',async()=>{
  const workflow=await fs.readFile('.github/workflows/radar-scan.yml','utf8');
  const keywords=await fs.readFile('scripts/dataforseo-keywords.mjs','utf8');
  assert.match(workflow,/DATAFORSEO_MAX_KEYWORDS: '25'/);
  assert.match(workflow,/DATAFORSEO_MAX_VARIANTS_PER_PRODUCT: '3'/);
  assert.match(workflow,/V26_MAX_PAID_CALLS: '3'/);
  assert.match(workflow,/DATAFORSEO_MAX_REQUEST_COST_USD: '0\.10'/);
  assert.match(keywords,/RO_COMMERCIAL_ROUND_ROBIN_V2/);
  assert.match(keywords,/for\(let round=0;round<rounds;round\+\+\)/);
  assert.match(keywords,/coverage<2/);
  assert.match(keywords,/const toQuery=uncached\.slice\(0,maxKeywords\)/);
});

test('ordinary script commits cannot trigger paid Radar Scan',async()=>{
  const workflow=await fs.readFile('.github/workflows/radar-scan.yml','utf8');
  assert.equal(workflow.includes("- 'scripts/**'"),false);
  assert.match(workflow,/- '\.deploy-trigger'/);
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/workflow_dispatch:/);
});
