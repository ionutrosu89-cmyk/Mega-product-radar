import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('30-piece freight registry stays fail-closed until a fully loaded carrier cost exists',()=>{
  const r=JSON.parse(fs.readFileSync('data/freight-benchmarks/car-sunglasses-magnetic-visor-holder-30pcs-registry.json','utf8'));
  assert.equal(r.market,'RO');
  assert.equal(r.quantity,30);
  assert.equal(r.cheapestDecisionUsable,null);
  assert.equal(r.decisionStatus,'FREIGHT_NOT_CONFIRMED');
  assert.ok(r.carriers.length>=3);
  assert.ok(r.carriers.every(x=>x.decisionUsable===false));
  assert.equal(r.purchaseAuthorized,false);
});
