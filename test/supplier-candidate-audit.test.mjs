import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('first supplier pilot keeps public listings unverified and blocks landed cost',async()=>{
  const data=JSON.parse(await fs.readFile('supplier-candidates/under-desk-headphone-hanger.json','utf8'));
  assert.equal(data.status,'CANDIDATE_RESEARCH_ONLY');
  assert.ok(data.candidates.length>=3&&data.candidates.length<=5);
  for(const c of data.candidates){
    assert.equal(c.evidenceStatus,'UNVERIFIED_PUBLIC_LISTING');
    assert.equal(c.quoteVerified,false);
    assert.equal(c.landedCostEligible,false);
    assert.match(c.sourceUrl,/^https:\/\//);
  }
});

test('supplier candidate audit cannot promote marketplace observations to verified quote',async()=>{
  const src=await fs.readFile('scripts/supplier-candidate-audit.mjs','utf8');
  assert.match(src,/quoteVerified:false/);
  assert.match(src,/landedCostEligible:false/);
  assert.match(src,/verifiedQuotes:0/);
  assert.match(src,/never upgrades a public listing to a verified quote/);
});

test('RFQ demands Romania shipping, exact item identity and manual verification',async()=>{
  const rfq=await fs.readFile('docs/rfq-under-desk-headphone-hanger.md','utf8');
  assert.match(rfq,/20 \/ 50 \/ 100 \/ 300 pieces/);
  assert.match(rfq,/DDP Romania/);
  assert.match(rfq,/Direct URL \/ SKU \/ model reference/);
  assert.match(rfq,/manual verification timestamp/i);
  assert.match(rfq,/landed cost remains blocked/i);
});
