import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync(new URL('../.github/workflows/radar-scan.yml',import.meta.url),'utf8');

test('scheduled and push Radar runs default to zero-paid',()=>{
  assert.match(workflow,/workflow_dispatch:\s*\n\s+inputs:/);
  assert.match(workflow,/allow_paid:[\s\S]*?default:\s*false/);
  assert.match(workflow,/Paid providers disabled: push\/schedule and default manual runs are zero-paid/);
});

test('every paid DataForSEO execution step requires explicit paid approval output',()=>{
  const paidStepConditions=[...workflow.matchAll(/if:\s*always\(\)\s*&&\s*steps\.paid_approval\.outputs\.approved\s*==\s*'true'\s*&&\s*steps\.total_budget\.outputs\.allow_paid\s*==\s*'true'/g)];
  assert.equal(paidStepConditions.length,2);
  assert.equal(/if:\s*always\(\)\s*&&\s*steps\.total_budget\.outputs\.allow_paid\s*==\s*'true'\s*\n\s*continue-on-error/.test(workflow),false);
});

test('explicit approval is one-run manual workflow_dispatch only',()=>{
  assert.match(workflow,/github\.event_name[^\n]*workflow_dispatch/);
  assert.match(workflow,/inputs\.allow_paid/);
  assert.match(workflow,/approved=false/);
});
