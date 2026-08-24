import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 deep provider scope follows dedicated secure deep marketplace priority',async()=>{
  const src=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  assert.match(src,/readStage0Targets\('DEEP'\)/);
  assert.doesNotMatch(src,/\/rest\/v1\/rpc\/stage0_deep_marketplace_targets/);
  assert.match(src,/deepProviderPriority:index\+1/);
  assert.match(src,/const scopedProducts=eligible\.map/);
  assert.match(src,/rank:index\+1/);
  assert.match(src,/products:scopedProducts/);
  assert.match(src,/goldenPipeline:p\?\.goldenPipeline/);
  assert.match(src,/deepPriorityOrder=eligible\.map/);
  assert.match(src,/first=\$\{eligible\.slice\(0,3\)/);
  assert.match(src,/authorization='GITHUB_OIDC_EDGE'/);
});
