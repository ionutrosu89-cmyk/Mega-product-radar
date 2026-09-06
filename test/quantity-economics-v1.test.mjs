import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeQuantityEconomics} from '../quantity-economics-v1.js';

const base={
 quantities:[30,50,100,300],
 supplierPriceTiers:[
  {minQty:30,unitPriceRon:4,evidenceRef:'q30'},
  {minQty:100,unitPriceRon:3.5,evidenceRef:'q100'},
  {minQty:300,unitPriceRon:3,evidenceRef:'q300'}
 ],
 freightByQuantity:[
  {quantity:30,totalFreightRon:180,verified:true,evidenceRef:'f30'},
  {quantity:50,totalFreightRon:220,verified:true,evidenceRef:'f50'},
  {quantity:100,totalFreightRon:300,verified:true,evidenceRef:'f100'},
  {quantity:300,totalFreightRon:600,verified:true,evidenceRef:'f300'}
 ],
 customsDutyRate:.05,importVatRate:.21,importVatRecoverable:true,sellPriceGrossRon:79.99
};

test('calculates 30 50 100 300 scenarios and recommends lowest-capital passing lot',()=>{
 const r=analyzeQuantityEconomics(base);
 assert.equal(r.rows.length,4);
 assert.ok(r.rows.every(x=>x.status==='CALCULATED'));
 assert.ok(r.recommendation);
 assert.equal(r.recommendation.quantity,30);
 assert.ok(r.rows.find(x=>x.quantity===300).landedCostPerUnitRon<r.rows.find(x=>x.quantity===30).landedCostPerUnitRon);
});

test('missing verified freight keeps that quantity unknown',()=>{
 const r=analyzeQuantityEconomics({...base,freightByQuantity:base.freightByQuantity.filter(x=>x.quantity!==50)});
 assert.equal(r.rows.find(x=>x.quantity===50).status,'UNKNOWN');
 assert.ok(r.rows.find(x=>x.quantity===50).blockers.includes('VERIFIED_FREIGHT_FOR_QUANTITY_MISSING'));
});
