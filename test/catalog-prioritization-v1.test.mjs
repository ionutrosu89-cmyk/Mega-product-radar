import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCatalogCandidate,prioritizeCatalog} from '../catalog-prioritization-v1.js';

test('complete strong-identity candidate ranks P1 without promoting evidence',()=>{
  const row=scoreCatalogCandidate({
    fingerprint:'abc',identityKeys:[{namespace:'ASIN',valueNorm:'B00TEST001'}],
    title:'Example Product',brand:'Example',category:'Home',model:'X1',
    sourceKey:'DATAFORSEO_AMAZON',sourceRecordId:'B00TEST001',observedAt:'2026-08-29T00:00:00Z'
  });
  assert.equal(row.score,100);
  assert.equal(row.priorityTier,'P1');
  assert.equal(row.eligibleForReview,true);
  assert.equal(row.evidenceClass,'CATALOG_PRIORITIZATION_ONLY');
  assert.equal(row.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(row.verifiedSalesRows,0);
  assert.equal(row.demandConfirmed,false);
  assert.equal(row.romaniaGapExact,false);
  assert.equal(row.supplierQuoteVerified,false);
  assert.equal(row.landedCostConfirmed,false);
  assert.equal(row.promising,false);
  assert.equal(row.validate,false);
  assert.equal(row.finalist,false);
  assert.equal(row.purchaseAuthorized,false);
});

test('missing strong identity is held even when descriptive data is rich',()=>{
  const row=scoreCatalogCandidate({title:'No Identity',brand:'Brand',category:'Home',model:'M1',sourceKey:'PUBLIC',sourceRecordId:'1',observedAt:'2026-08-29T00:00:00Z'});
  assert.equal(row.eligibleForReview,false);
  assert.equal(row.priorityTier,'HOLD');
});

test('prioritization is deterministic and topN bounded',()=>{
  const candidates=[
    {fingerprint:'b',identityKeys:[{namespace:'GTIN',valueNorm:'00000000000002'}],title:'B',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'2'},
    {fingerprint:'a',identityKeys:[{namespace:'GTIN',valueNorm:'00000000000001'}],title:'A',brand:'Brand',category:'Food',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'1'}
  ];
  const result=prioritizeCatalog(candidates,{topN:1});
  assert.equal(result.inputCount,2);
  assert.equal(result.selectedCount,1);
  assert.equal(result.selected[0].fingerprint,'a');
  assert.equal(result.policy.providerDataSpendEur,0);
  assert.equal(result.policy.paidDataCallsTriggered,0);
  assert.equal(result.policy.purchaseAuthorized,false);
  assert.equal(result.policy.verifiedSalesRows,0);
});
