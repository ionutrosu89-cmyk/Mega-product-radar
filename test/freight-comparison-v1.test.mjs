import test from 'node:test';
import assert from 'node:assert/strict';
import {compareFreightOptions} from '../freight-comparison-v1.js';

test('selects cheapest only among strong evidence freight options',()=>{
  const r=compareFreightOptions({carton:{lengthCm:50,widthCm:40,heightCm:40,actualGrossWeightKg:7},options:[
    {id:'ups',carrierCode:'UPS',mode:'EXPRESS_AIR',rateRonPerChargeableKg:20,evidenceClass:'VERIFIED',evidenceRef:'ups-rate'},
    {id:'weak',carrierCode:'DHL_EXPRESS',mode:'EXPRESS_AIR',rateRonPerChargeableKg:10,evidenceClass:'HEURISTIC',evidenceRef:'guess'}
  ]});
  assert.equal(r.status,'READY');
  assert.equal(r.cheapestVerified.id,'ups');
  assert.equal(r.cheapestVerified.chargeableWeightKg,16);
});

test('weak or missing evidence fails closed',()=>{
  const r=compareFreightOptions({options:[{id:'x',mode:'QUOTE_TOTAL',quotedFreightRon:100,evidenceClass:'UNKNOWN'}]});
  assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');
  assert.equal(r.verifiedOptionCount,0);
});
