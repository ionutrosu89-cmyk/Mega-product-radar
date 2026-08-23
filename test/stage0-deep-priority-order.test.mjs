import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 deep provider scope is ordered by Budget Brain paidDataPriority',async()=>{
  const src=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  assert.match(src,/paidDataPriority/);
  assert.match(src,/if\(ap!==bp\)return ap-bp/);
  assert.match(src,/const scoped=\{\.\.\.original,products:eligible\}/);
  assert.match(src,/priorityOrder=eligible\.map/);
  assert.match(src,/first=\$\{eligible\.slice\(0,3\)/);
});
