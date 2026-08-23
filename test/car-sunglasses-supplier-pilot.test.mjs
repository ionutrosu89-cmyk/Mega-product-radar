import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('priority car sunglasses pilot contains 3–5 unverified public candidates only',async()=>{
  const data=JSON.parse(await fs.readFile('supplier-candidates/car-sunglasses-magnetic-visor-holder.json','utf8'));
  assert.equal(data.product.canonicalKey,'car-sunglasses-magnetic-visor-holder');
  assert.equal(data.product.selectionSource,'FINALIST_EVIDENCE_QUEUE');
  assert.equal(data.status,'CANDIDATE_RESEARCH_ONLY');
  assert.ok(data.candidates.length>=3&&data.candidates.length<=5);
  for(const candidate of data.candidates){
    assert.equal(candidate.evidenceStatus,'UNVERIFIED_PUBLIC_LISTING');
    assert.equal(candidate.quoteVerified,false);
    assert.equal(candidate.landedCostEligible,false);
    assert.match(candidate.sourceUrl,/^https:\/\//);
    assert.ok(Number(candidate.observedMoq)>0);
  }
});

test('car sunglasses RFQ requires exact product identity and Romania commercial terms',async()=>{
  const rfq=await fs.readFile('docs/rfq-car-sunglasses-magnetic-visor-holder.md','utf8');
  assert.match(rfq,/Status: TEMPLATE — NOT SENT/);
  assert.match(rfq,/20 \/ 50 \/ 100 \/ 300 pieces/);
  assert.match(rfq,/Sample shipping cost to Romania/);
  assert.match(rfq,/DDP Romania/);
  assert.match(rfq,/Incoterm/);
  assert.match(rfq,/Direct product URL and exact SKU\/model reference/);
  assert.match(rfq,/manual verification timestamp/i);
  assert.match(rfq,/Missing values remain UNKNOWN/);
  assert.match(rfq,/Confirmed landed cost remains blocked/);
});

test('car sunglasses pilot cannot treat listing price or sales count as a verified quote',async()=>{
  const data=await fs.readFile('supplier-candidates/car-sunglasses-magnetic-visor-holder.json','utf8');
  assert.match(data,/Observed marketplace listing data is discovery evidence only/);
  assert.match(data,/no observed public price is a verified quote/);
  assert.match(data,/no candidate may feed confirmed landed cost/);
});
