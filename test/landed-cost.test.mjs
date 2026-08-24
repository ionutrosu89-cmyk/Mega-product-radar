import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLandedCost, landedCostStatus, normalizeLandedRecord } from '../landed-cost.js';

const provided={fxRate:true,unitPriceForeign:true,quantity:true,internationalFreight:true,customsDutyRate:true,customsFixed:true,brokerage:true,domesticFreight:true,inspection:true,labelsPackaging:true,otherFixed:true};
const confirmationEvidence={provided,internationalFreight:0,customsDutyRate:0,customsFixed:0,brokerage:0,domesticFreight:0,inspection:0,labelsPackaging:0,otherFixed:0,fxSource:'bank statement',fxVerifiedAt:'2026-08-24T06:00:00Z',customsStatus:'NOT_APPLICABLE',importVatTreatment:'DEDUCTIBLE_EXCLUDED_FROM_COST',freightEvidenceRef:'freight quote F-1',supplierQuoteRef:'supplier quote Q-1',manualVerifiedBy:'operator',manualVerifiedAt:'2026-08-24T06:05:00Z'};

test('landed cost record normalizes currency and numeric fields',()=>{
  const r=normalizeLandedRecord({currency:'usd',fxRate:'4.6',unitPriceForeign:'10',quantity:'100.4',customsDutyRate:'3'});
  assert.equal(r.currency,'USD');
  assert.equal(r.fxRate,4.6);
  assert.equal(r.unitPriceForeign,10);
  assert.equal(r.quantity,100);
  assert.equal(r.customsDutyRate,3);
});

test('landed cost calculates goods, freight, duty and fixed costs per unit',()=>{
  const c=calculateLandedCost({currency:'USD',fxRate:5,unitPriceForeign:10,quantity:100,internationalFreight:1000,customsDutyRate:5,brokerage:200,domesticFreight:300,inspection:100,labelsPackaging:400,otherFixed:0});
  assert.equal(c.goodsRon,5000);
  assert.equal(c.duty,300);
  assert.equal(c.fixed,1000);
  assert.equal(c.total,7300);
  assert.equal(c.perUnit,73);
});

test('landed cost cannot be confirmed without price, rate and quantity',()=>{
  assert.equal(landedCostStatus({confirmed:true}).status,'INCOMPLET');
});

test('valid landed cost stays simulated until complete evidence and manual confirmation',()=>{
  const base={currency:'CNY',fxRate:0.65,unitPriceForeign:50,quantity:20,...confirmationEvidence};
  assert.equal(landedCostStatus({...base,confirmationRequested:false}).status,'SIMULAT');
  assert.equal(landedCostStatus({...base,confirmationRequested:true}).status,'CONFIRMAT');
  assert.equal(landedCostStatus({...base,confirmationRequested:true,fxSource:''}).status,'SIMULAT');
});
