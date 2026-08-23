import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 maps Budget Brain priority into isolated provider rank and restores Golden rank',async()=>{
  const source=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  assert.match(source,/paidDataPriority\|\|index\+1/);
  assert.match(source,/const scopedProducts=eligible\.map/);
  assert.match(source,/goldenPipeline:p\?\.goldenPipeline/);
  assert.match(source,/out\.priorityOrder=eligible\.map/);
  assert.match(source,/source\?\.goldenPipeline\?\.rank\?\?item\?\.rank/);
});
