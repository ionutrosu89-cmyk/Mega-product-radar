import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Supplier Intelligence V3 stays blocked without an authorized finalist',async()=>{
  const src=await fs.readFile('scripts/supplier-intelligence-v3.mjs','utf8');
  assert.match(src,/supplierIntelligenceAuthorized===true/);
  assert.match(src,/SUPPLIER_PAGE_EVIDENCE/);
  assert.match(src,/BLOCKED_NO_AUTHORIZED_FINALIST/);
  assert.match(src,/minimumComparableOffers:3/);
  assert.match(src,/targetOfferCount:5/);
  assert.match(src,/screeningEconomicsEligible:true/);
  assert.match(src,/landedCostEligible:false/);
  assert.match(src,/testGateEligible:false/);
  assert.match(src,/buyGateEligible:false/);
  assert.match(src,/page-backed only/i);
  assert.match(src,/no supplier outreach/i);
});

test('Supplier Intelligence V3 workflow is zero-cost and cannot trigger paid Radar',async()=>{
  const workflow=await fs.readFile('.github/workflows/supplier-intelligence-v3.yml','utf8');
  assert.match(workflow,/finalist-evidence-queue-live\.json/);
  assert.match(workflow,/node scripts\/supplier-intelligence-v3\.mjs/);
  assert.equal(workflow.includes('DATAFORSEO'),false);
  assert.equal(workflow.includes('.deploy-trigger'),false);
  assert.equal(workflow.includes('radar-scan'),false);
});
