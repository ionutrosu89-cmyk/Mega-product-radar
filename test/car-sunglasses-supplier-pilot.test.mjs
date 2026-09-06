import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('priority car sunglasses pilot uses page-backed public candidates only',async()=>{
  const data=JSON.parse(await fs.readFile('supplier-candidates/car-sunglasses-magnetic-visor-holder.json','utf8'));
  assert.equal(data.product.canonicalKey,'car-sunglasses-magnetic-visor-holder');
  assert.equal(data.product.selectionSource,'FINALIST_EVIDENCE_QUEUE');
  assert.equal(data.status,'PAGE_BACKED_SOURCING_ACTIVE');
  assert.ok(data.candidates.length>=3&&data.candidates.length<=5);
  for(const candidate of data.candidates){
    assert.ok(['UNVERIFIED_PUBLIC_LISTING','DIRECT_PUBLIC_LISTING_UNVERIFIED_COMMERCIAL_TERMS','PAGE_BACKED_SCREENING_READY','DIRECT_PAGE_COMPARABLE_VARIANT'].includes(candidate.evidenceStatus));
    assert.equal(candidate.quoteVerified,false);
    assert.equal(candidate.landedCostEligible,false);
    assert.equal(candidate.supplierContactRequired,false);
    assert.match(candidate.sourceUrl,/alibaba\.com\/(?:pla|product-detail)\//);
    assert.match(candidate.sourceUrl,/^https:\/\//);
    assert.ok(Number(candidate.observedMoq)>0);
  }
});

test('car sunglasses RFQ is archived and must not trigger supplier outreach',async()=>{
  const rfq=await fs.readFile('docs/rfq-car-sunglasses-magnetic-visor-holder.md','utf8');
  assert.match(rfq,/ARCHIVED/);
  assert.match(rfq,/DO_NOT_SEND/);
  assert.match(rfq,/page-backed/i);
  assert.match(rfq,/must not generate an intervention task/i);
});

test('car sunglasses pilot cannot treat listing price or sales count as a verified quote',async()=>{
  const data=await fs.readFile('supplier-candidates/car-sunglasses-magnetic-visor-holder.json','utf8');
  assert.match(data,/page-backed only/i);
  assert.match(data,/Public values are not negotiated quotes/i);
  assert.match(data,/Missing fields stay UNKNOWN/i);
});
