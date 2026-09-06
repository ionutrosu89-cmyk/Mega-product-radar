import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('priority RFQ dispatch queue is closed under page-backed no-contact policy',async()=>{
  const queue=JSON.parse(await fs.readFile('supplier-rfq-dispatch/car-sunglasses-magnetic-visor-holder.json','utf8'));
  assert.equal(queue.productCanonicalKey,'car-sunglasses-magnetic-visor-holder');
  assert.equal(queue.entries.length,5);
  assert.ok(queue.entries.every(x=>x.status==='CLOSED'));
  assert.ok(queue.entries.every(x=>x.closeReason==='NO_CONTACT_POLICY_PAGE_BACKED_SOURCING'));
  assert.ok(queue.entries.every(x=>x.requiresUserAction===false&&x.supplierContactRequired===false));
  assert.match(queue.policy,/outreach is disabled/i);
  assert.match(queue.policy,/must not generate intervention alerts/i);
});

test('car sunglasses quote intake template is incomplete and landed-cost blocked by default',async()=>{
  const quote=JSON.parse(await fs.readFile('supplier-quotes/templates/car-sunglasses-magnetic-visor-holder-quote.json','utf8'));
  assert.equal(quote.productCanonicalKey,'car-sunglasses-magnetic-visor-holder');
  assert.equal(quote.evidenceStatus,'QUOTE_INCOMPLETE');
  assert.equal(quote.landedCostEligible,false);
  assert.equal(quote.unitPrice,null);
  assert.equal(quote.bulkShippingToRomania,null);
  assert.equal(quote.manualVerifiedAt,null);
});
