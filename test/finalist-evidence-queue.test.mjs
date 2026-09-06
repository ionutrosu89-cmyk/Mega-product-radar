import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Finalist Evidence Queue authorizes page-backed supplier work only after RO demand and high-confidence sales',async()=>{
  const src=await fs.readFile('scripts/finalist-evidence-queue.mjs','utf8');
  assert.match(src,/const stage=String\(p\?\.stage\|\|''\)/);
  assert.match(src,/\['VALIDATE','FINALIST'\]\.includes\(stage\)/);
  assert.match(src,/PROVIDER_VERIFIED/);
  assert.match(src,/ESTIMATED_HIGH_CONFIDENCE/);
  assert.match(src,/salesEstimateConfidence/);
  assert.match(src,/>=75/);
  assert.match(src,/supplierIntelligenceAuthorized:p\.nextGate==='SUPPLIER_PAGE_EVIDENCE'/);
  assert.match(src,/requiredSupplierEvidence/);
  assert.match(src,/do not contact suppliers/);
  assert.match(src,/never promotes TEST\/BUY/);
  assert.match(src,/invent landed cost/);
});

test('Finalist Evidence Queue workflow is zero-cost and cannot trigger Radar Scan',async()=>{
  const workflow=await fs.readFile('.github/workflows/finalist-evidence-queue.yml','utf8');
  assert.match(workflow,/golden-pipeline-live\.json/);
  assert.match(workflow,/node scripts\/finalist-evidence-queue\.mjs/);
  assert.equal(workflow.includes('DATAFORSEO'),false);
  assert.equal(workflow.includes('.deploy-trigger'),false);
  assert.equal(workflow.includes('radar-scan'),false);
});
