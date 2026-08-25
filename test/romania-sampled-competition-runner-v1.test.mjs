import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('sampled competition runner is offline and cannot unlock advanced funnel stages',async()=>{
  const js=await fs.readFile(new URL('../scripts/romania-sampled-competition-v1.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  assert.match(js,/DISCOVERED_OR_PROMISING_ONLY/);
  assert.match(js,/NEVER_REPLACES_EXACT_ROMANIA_GAP_GATE/);
  assert.match(js,/paidCallsTriggered:0/);
  assert.match(js,/purchaseAuthorized:false/);
});
