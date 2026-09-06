import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConsolidationBasketV1,optimizeTwoSkuFillV1} from '../consolidation-basket-v1.js';

test('basket accepts page-backed volume/weight evidence',()=>{
 const r=buildConsolidationBasketV1({targetMinimumMeasure:1,ratePerMeasureRon:1000,products:[
  {productKey:'a',title:'A',packageDimensions:{lengthCm:10,widthCm:3.5,heightCm:2},evidenceClass:'DIRECT_OBSERVED'},
  {productKey:'b',title:'B',packageDimensions:{lengthCm:21,widthCm:11,heightCm:14},unitGrossWeightKg:.5,evidenceClass:'DIRECT_OBSERVED'}
 ],candidateQuantities:[100]});
 assert.equal(r.status,'SCREENING_READY');
 assert.equal(r.candidates.length,2);
});

test('two SKU optimizer can fill one revenue ton/cbm target',()=>{
 const r=optimizeTwoSkuFillV1({
  skuA:{packageDimensions:{lengthCm:10,widthCm:3.5,heightCm:2},unitPriceRon:3.4},
  skuB:{packageDimensions:{lengthCm:21,widthCm:11,heightCm:14},unitGrossWeightKg:.5,unitPriceRon:12.5},
  targetMeasure:1,maxQtyA:1000,maxQtyB:400,stepA:10,stepB:10
 });
 assert.equal(r.status,'SCREENING_READY');
 assert.ok(r.totalMeasure>=1);
});
