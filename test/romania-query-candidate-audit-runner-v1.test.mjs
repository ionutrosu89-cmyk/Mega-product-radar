import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('runner is offline and preserves no-spend/no-buy policy',async()=>{
  const js=await fs.readFile(new URL('../scripts/romania-query-candidate-audit-v1.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  assert.match(js,/paidCallsTriggered:0/);
  assert.match(js,/approvedSpendEur:0/);
  assert.match(js,/purchaseAuthorized:false/);
});
