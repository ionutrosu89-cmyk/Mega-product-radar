import assert from 'node:assert/strict';
import test from 'node:test';
import {computeChargeableWeight,computeLandedCostV4} from '../landed-cost-engine-v4.js';

test('actual weight dominates when heavier than volumetric',()=>{
  const result=computeChargeableWeight({actualWeightKg:2,lengthCm:20,widthCm:20,heightCm:20,volumetricDivisor:5000});
  assert.equal(result.ok,true);
  assert.equal(result.chargeableBasis,'ACTUAL');
  assert.equal(result.chargeableWeightKg,2);
});

test('volumetric weight dominates when parcel volume is larger',()=>{
  const result=computeChargeableWeight({actualWeightKg:1,lengthCm:50,widthCm:40,heightCm:30,volumetricDivisor:5000});
  assert.equal(result.ok,true);
  assert.equal(result.chargeableBasis,'VOLUMETRIC');
  assert.equal(result.volumetricWeightKg,12);
  assert.equal(result.chargeableWeightKg,12);
});

test('volumetric divisor is configurable',()=>{
  const a=computeChargeableWeight({actualWeightKg:1,lengthCm:40,widthCm:30,heightCm:20,volumetricDivisor:5000});
  const b=computeChargeableWeight({actualWeightKg:1,lengthCm:40,widthCm:30,heightCm:20,volumetricDivisor:6000});
  assert.equal(a.volumetricWeightKg,4.8);
  assert.equal(b.volumetricWeightKg,4);
});

test('unknown dimensions fail closed instead of guessing shipping',()=>{
  const result=computeChargeableWeight({actualWeightKg:1,lengthCm:40,widthCm:30,volumetricDivisor:5000});
  assert.equal(result.ok,false);
  assert.equal(result.code,'DIMENSIONS_REQUIRED');
});

const base={supplierUnitPriceEur:10,quantity:10,actualWeightKg:1,lengthCm:20,widthCm:20,heightCm:20,volumetricDivisor:5000,freightRateEurPerChargeableKg:4,dutyRatePct:5,importVatRatePct:21,importVatTreatment:'RECOVERABLE',sellingPriceGrossEur:35,sellingPriceTreatment:'VAT_INCLUSIVE',saleVatRatePct:21,marketplaceFeePct:15};

test('recoverable import VAT affects cash landed cost but not economic landed cost',()=>{
  const result=computeLandedCostV4(base);
  assert.equal(result.ok,true);
  assert.ok(result.unit.landedCashEur>result.unit.landedEconomicEur);
  assert.equal(result.assumptions.importVatTreatment,'RECOVERABLE');
  assert.equal(result.assumptions.chargeableWeightRule,'MAX_ACTUAL_VOLUMETRIC');
});

test('non-recoverable import VAT is included in economic landed cost',()=>{
  const result=computeLandedCostV4({...base,importVatTreatment:'NON_RECOVERABLE'});
  assert.equal(result.ok,true);
  assert.equal(result.unit.landedCashEur,result.unit.landedEconomicEur);
});

test('VAT treatment must be explicit and negotiated price is never assumed',()=>{
  const result=computeLandedCostV4({...base,importVatTreatment:undefined});
  assert.equal(result.ok,false);
  assert.equal(result.code,'IMPORT_VAT_TREATMENT_REQUIRED');
  const valid=computeLandedCostV4(base);
  assert.equal(valid.assumptions.supplierPriceBasis,'PUBLIC_STANDARD_BASELINE');
  assert.equal(valid.assumptions.negotiatedPriceIncluded,false);
});
