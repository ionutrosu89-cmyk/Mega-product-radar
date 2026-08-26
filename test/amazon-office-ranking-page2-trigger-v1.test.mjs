import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const workflowUrl=new URL('../.github/workflows/amazon-public-ranking-snapshot.yml',import.meta.url);
const markerUrl=new URL('../data/amazon-office-ranking-page2-trigger-2026-08-26.json',import.meta.url);

test('Office Products page 2 trigger is main-only and marker scoped',async()=>{
  const yml=await fs.readFile(workflowUrl,'utf8');
  assert.match(yml,/push:\s*[\s\S]*branches:\s*[\s\S]*- main/);
  assert.match(yml,/amazon-office-ranking-page2-trigger-2026-08-26\.json/);
  assert.match(yml,/AMAZON_OFFICE_PRODUCTS_RANKING_PAGE2_2026_08_26/);
});

test('page 2 collector uses explicit page 2 URL and preserves rank truth policy',async()=>{
  const yml=await fs.readFile(workflowUrl,'utf8');
  const marker=JSON.parse(await fs.readFile(markerUrl,'utf8'));
  assert.equal(marker.page,2);
  assert.match(marker.sourceUrl,/gp\/bestsellers\/office-products\?pg=2&language=en_US/);
  assert.match(yml,/gp\/bestsellers\/office-products\?pg=2&language=en_US/);
  assert.equal(marker.providerSpendEur,0);
  assert.equal(marker.paidCallsAuthorized,false);
  assert.equal(marker.purchaseAuthorized,false);
  assert.equal(marker.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(marker.explicitRankOnly,true);
  assert.equal(marker.htmlPositionIsNotRank,true);
  assert.match(yml,/explicitRankOnly!==true/);
  assert.match(yml,/htmlPositionIsNotRank!==true/);
});

test('page 2 trigger cannot authorize verified sales paid calls or purchase',async()=>{
  const marker=JSON.parse(await fs.readFile(markerUrl,'utf8'));
  assert.notEqual(marker.salesEvidenceClass,'VERIFIED_SALES');
  assert.equal(marker.providerSpendEur,0);
  assert.equal(marker.purchaseAuthorized,false);
});
