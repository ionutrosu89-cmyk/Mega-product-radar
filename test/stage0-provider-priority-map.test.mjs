import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 maps secure deep priority into isolated provider rank and restores Golden rank',async()=>{
  const source=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  assert.match(source,/readStage0Targets\('DEEP'\)/);
  assert.doesNotMatch(source,/sb_publishable_/);
  assert.match(source,/deepProviderPriority:index\+1/);
  assert.match(source,/rank:index\+1/);
  assert.match(source,/const scopedProducts=eligible\.map/);
  assert.match(source,/goldenPipeline:p\?\.goldenPipeline/);
  assert.match(source,/out\.deepPriorityOrder=eligible\.map/);
  assert.match(source,/source\?\.goldenPipeline\?\.rank\?\?item\?\.rank/);
});
