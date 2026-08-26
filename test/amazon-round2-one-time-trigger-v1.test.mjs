import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/amazon-round2-refresh.yml','utf8');
const marker=JSON.parse(fs.readFileSync('data/amazon-round2-trigger-2026-08-26.json','utf8'));

test('one-time Round2 push trigger is scoped to the dated marker on main',()=>{
  assert.match(workflow,/push:\s*[\s\S]*branches:\s*[\s\S]*- main/);
  assert.match(workflow,/paths:\s*[\s\S]*amazon-round2-trigger-2026-08-26\.json/);
  assert.equal(marker.triggerId,'AMAZON_ROUND2_2026_08_26');
  assert.equal(marker.maxItems,255);
  assert.equal(marker.notBefore,'2026-08-26T03:56:23.583Z');
});

test('push trigger defaults to 255 and preserves zero-paid no-buy policy',()=>{
  assert.match(workflow,/ROUND2_MAX_ITEMS:[^\n]*workflow_dispatch[^\n]*inputs\.max_items[^\n]*'255'/);
  assert.equal(marker.providerSpendEur,0);
  assert.equal(marker.paidCallsAuthorized,false);
  assert.equal(marker.purchaseAuthorized,false);
  assert.equal(marker.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(marker.rankEvidencePolicy,'NO_RANK_FROM_PRODUCT_PAGE');
});

test('workflow still enforces Round2 truth gates',()=>{
  assert.match(workflow,/capturedCount!==255/);
  assert.match(workflow,/providerSpendEur!==0/);
  assert.match(workflow,/paidCallsTriggered!==0/);
  assert.match(workflow,/minimumObservationIntervalHours<24/);
  assert.match(workflow,/rankVelocity!==null/);
  assert.match(workflow,/sourceRank!==null/);
  assert.match(workflow,/purchaseAuthorized!==false/);
});
