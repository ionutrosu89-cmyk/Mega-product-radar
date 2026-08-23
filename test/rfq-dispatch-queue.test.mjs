import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('priority RFQ dispatch queue starts entirely NOT_SENT',async()=>{
  const queue=JSON.parse(await fs.readFile('supplier-rfq-dispatch/car-sunglasses-magnetic-visor-holder.json','utf8'));
  assert.equal(queue.productCanonicalKey,'car-sunglasses-magnetic-visor-holder');
  assert.equal(queue.entries.length,5);
  for(const entry of queue.entries){
    assert.equal(entry.status,'NOT_SENT');
    assert.equal(entry.sentAt,null);
    assert.equal(entry.sentBy,null);
    assert.equal(entry.responseReceivedAt,null);
    assert.equal(entry.responseReference,null);
    assert.equal(entry.quoteFile,null);
  }
  assert.match(queue.policy,/never means a supplier was contacted/);
  assert.match(queue.policy,/SENT requires a real human\/agent dispatch timestamp/);
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
