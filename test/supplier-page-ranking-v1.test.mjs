import test from 'node:test';
import assert from 'node:assert/strict';
import {rankSupplierPagesV1} from '../supplier-page-ranking-v1.js';

test('ranking rewards page evidence quality and does not simply select the cheapest sparse candidate',()=>{
 const r=rankSupplierPagesV1([
  {supplierName:'Sparse Cheap',sourceUrl:'https://x.test/p',pageBackedScreeningReady:true,productMatch:'HIGH',observedPriceMaxUsd:.70,observedMoq:10},
  {supplierName:'Established',sourceUrl:'https://x.test/p2',supplierProfileUrl:'https://x.test/s',pageBackedScreeningReady:true,productMatch:'HIGH',observedPriceMaxUsd:.75,observedMoq:2,supplierYearsObserved:20,supplierRatingObserved:4.6,material:'PU',productDimensions:{l:10}}
 ]);
 assert.equal(r.status,'RANKED');
 assert.equal(r.leader.supplierName,'Established');
 assert.ok(r.leader.evidenceConfidencePct>r.ranked[1].evidenceConfidencePct);
 assert.equal(r.leader.purchaseAuthorized,false);
});

test('medium-match comparable variants do not enter exact supplier ranking',()=>{
 const r=rankSupplierPagesV1([{supplierName:'Comparable',pageBackedScreeningReady:true,productMatch:'MEDIUM',observedPriceMaxUsd:.5,observedMoq:1}]);
 assert.equal(r.status,'NO_DIRECT_PAGE_CANDIDATES');
});
