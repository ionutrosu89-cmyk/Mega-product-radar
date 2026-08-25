import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const meta=JSON.parse(fs.readFileSync(new URL('../data/romania-query-candidate-audit-v1.meta.json',import.meta.url),'utf8'));

test('candidate audit provenance records public-surface limitations and no-spend policy',()=>{
  assert.equal(meta.sources.length,2);
  assert.ok(meta.limitations.includes('NO_QUERY_SCOPED_EXACT_COUNT_AVAILABLE'));
  assert.equal(meta.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(meta.paidCallsTriggered,0);
  assert.equal(meta.purchaseAuthorized,false);
});
