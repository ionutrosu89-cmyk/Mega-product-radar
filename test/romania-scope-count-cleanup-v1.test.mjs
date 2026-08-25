import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const d=JSON.parse(fs.readFileSync(new URL('../data/romania-public-market-evidence-batch-v1.cleaned.json',import.meta.url),'utf8'));

test('contaminated Romania marketplace surface counts never become canonical lower bounds',()=>{
  assert.equal(d.corrections.length,3);
  for(const row of d.corrections){
    assert.ok(Number(row.surfaceItemCountLowerBound)>0);
    assert.equal(row.listingCountLowerBound,null);
    assert.equal(row.listingCount,null);
    assert.equal(row.comparableScopeConfirmed,false);
  }
});

test('semantic cleanup remains zero-spend and non-purchasing',()=>{
  assert.equal(d.paidCallsTriggered,0);
  assert.equal(d.approvedSpendEur,0);
  assert.equal(d.purchaseAuthorized,false);
  assert.match(d.policy,/NO_VERIFIED_SALES/);
});
