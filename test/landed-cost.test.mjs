import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLandedCost, landedCostStatus, normalizeLandedRecord } from '../landed-cost.js';

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

test('valid landed cost stays simulated until manually confirmed',()=>{
  const base={currency:'CNY',fxRate:0.65,unitPriceForeign:50,quantity:20};
  assert.equal(landedCostStatus(base).status,'SIMULAT');
  assert.equal(landedCostStatus({...base,confirmed:true}).status,'CONFIRMAT');
});
