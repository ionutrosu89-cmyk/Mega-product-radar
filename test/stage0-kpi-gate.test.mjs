import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Stage 0 KPI gate keeps promotion manual and thresholds conservative',async()=>{
  const script=await fs.readFile('scripts/stage0-kpi-evaluator.mjs','utf8');
  assert.match(script,/minEnrichmentSuccessPct:50/);
  assert.match(script,/maxCostPerUsefulEnrichmentEur:\.50/);
  assert.match(script,/maxStage0SpendEur:10/);
  assert.match(script,/manualPromotionRequired:true/);
  assert.match(script,/STAGE0_HEALTHY_MANUAL_REVIEW/);
  assert.match(script,/HOLD_STAGE0/);
});

test('Stage 0 KPI workflow runs after Radar Scan and does not trigger paid scan itself',async()=>{
  const workflow=await fs.readFile('.github/workflows/stage0-kpi.yml','utf8');
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/Mega Product Radar Scan/);
  assert.match(workflow,/stage0-kpi-evaluator\.mjs/);
  assert.match(workflow,/stage0-kpi-live\.json/);
});
