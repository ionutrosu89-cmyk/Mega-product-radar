import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Radar builds Finalist and Supplier queues in-process before persistence',async()=>{
  const workflow=await fs.readFile('.github/workflows/radar-scan.yml','utf8');
  const golden=workflow.indexOf('node scripts/golden-product-pipeline.mjs --phase=final');
  const finalist=workflow.indexOf('node scripts/finalist-evidence-queue.mjs');
  const supplier=workflow.indexOf('node scripts/supplier-intelligence-v3.mjs');
  const persist=workflow.indexOf('Persist radar, discovery, organic and intelligence histories and scan status');
  assert.ok(golden>0&&finalist>golden&&supplier>finalist&&persist>supplier);
  assert.match(workflow,/finalist-evidence-queue-live\.json/);
  assert.match(workflow,/supplier-intelligence-v3-live\.json/);
});
