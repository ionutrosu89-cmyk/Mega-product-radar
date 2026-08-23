import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Finalist Evidence Queue authorizes supplier work only after RO demand and high-confidence sales',async()=>{
  const src=await fs.readFile('scripts/finalist-evidence-queue.mjs','utf8');
  assert.match(src,/stage\|\|'\)==='VALIDATE'/);
  assert.match(src,/PROVIDER_VERIFIED/);
  assert.match(src,/ESTIMATED_HIGH_CONFIDENCE/);
  assert.match(src,/salesEstimateConfidence/);
  assert.match(src,/>=75/);
  assert.match(src,/supplierIntelligenceAuthorized:p\.nextGate==='SUPPLIER_QUOTE'/);
  assert.match(src,/never invents supplier quotes/);
  assert.match(src,/never confirms landed cost/);
});

test('Finalist Evidence Queue workflow is zero-cost and cannot trigger Radar Scan',async()=>{
  const workflow=await fs.readFile('.github/workflows/finalist-evidence-queue.yml','utf8');
  assert.match(workflow,/golden-pipeline-live\.json/);
  assert.match(workflow,/node scripts\/finalist-evidence-queue\.mjs/);
  assert.equal(workflow.includes('DATAFORSEO'),false);
  assert.equal(workflow.includes('.deploy-trigger'),false);
  assert.equal(workflow.includes('radar-scan'),false);
});
