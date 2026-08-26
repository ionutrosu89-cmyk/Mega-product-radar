import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/amazon-public-ranking-snapshot.yml','utf8');
const marker=JSON.parse(fs.readFileSync('data/amazon-office-ranking-trigger-2026-08-26.json','utf8'));

test('one-time Office Products ranking trigger is marker scoped on main',()=>{
  assert.match(workflow,/push:\s*[\s\S]*branches:\s*[\s\S]*- main/);
  assert.match(workflow,/paths:\s*[\s\S]*amazon-office-ranking-trigger-2026-08-26\.json/);
  assert.equal(marker.triggerId,'AMAZON_OFFICE_PRODUCTS_RANKING_2026_08_26');
  assert.equal(marker.categoryKey,'amazon:office-products:best-sellers');
});

test('ranking trigger preserves explicit-rank zero-cost policy',()=>{
  assert.equal(marker.providerSpendEur,0);
  assert.equal(marker.paidCallsAuthorized,false);
  assert.equal(marker.purchaseAuthorized,false);
  assert.equal(marker.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(marker.explicitRankOnly,true);
  assert.equal(marker.htmlPositionIsNotRank,true);
  assert.match(workflow,/explicitRankOnly!==true/);
  assert.match(workflow,/htmlPositionIsNotRank!==true/);
  assert.match(workflow,/rankEvidenceClass!=='EXPLICIT_PUBLIC_RANK_BADGE'/);
});

test('push execution uses fixed Office Products defaults rather than empty dispatch inputs',()=>{
  assert.match(workflow,/RANKING_CATEGORY_KEY:[^\n]*office-products:best-sellers/);
  assert.match(workflow,/RANKING_CATEGORY_LABEL:[^\n]*Office Products/);
  assert.match(workflow,/RANKING_SOURCE_URL:[^\n]*amazon\.com\/gp\/bestsellers\/office-products/);
});
