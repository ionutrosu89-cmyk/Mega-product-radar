import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLandedRecord,landedCostStatus} from '../landed-cost.js';

const ID='123e4567-e89b-42d3-a456-426614174000';
const complete={
  fxRate:4.6,unitPriceForeign:10,quantity:100,internationalFreight:500,
  customsDutyRate:3,customsFixed:0,brokerage:100,domesticFreight:100,
  inspection:0,labelsPackaging:50,otherFixed:0,
  provided:{fxRate:true,unitPriceForeign:true,quantity:true,internationalFreight:true,customsDutyRate:true,customsFixed:true,brokerage:true,domesticFreight:true,inspection:true,labelsPackaging:true,otherFixed:true},
  fxSource:'manual evidence',fxVerifiedAt:'2026-08-26T10:00:00Z',
  customsStatus:'VERIFIED',customsClassificationRef:'TEST-CN',
  importVatTreatment:'DEDUCTIBLE',vatCostReference:'VAT-REF',
  freightEvidenceRef:'FREIGHT-REF',supplierQuoteRef:'QUOTE-REF',
  manualVerifiedBy:'reviewer',manualVerifiedAt:'2026-08-26T10:05:00Z',
  confirmationRequested:true
};

test('landed economics without canonicalProductId can never become confirmed',()=>{
  const r=normalizeLandedRecord({...complete,productName:'Same title'});
  assert.equal(r.canonicalProductId,null);
  assert.equal(r.decisionEligible,false);
  assert.equal(r.confirmed,false);
  const status=landedCostStatus(r);
  assert.notEqual(status.status,'CONFIRMAT');
  assert.equal(status.identityBlocked,true);
});

test('canonical identity is preserved on economics records',()=>{
  const r=normalizeLandedRecord({...complete,canonicalProductId:ID,productName:'Display label only'});
  assert.equal(r.canonicalProductId,ID);
  assert.equal(r.identityStatus,'CANONICAL');
  assert.equal(r.decisionEligible,true);
});

test('invalid canonical id is treated as legacy label-only rather than silently accepted',()=>{
  const r=normalizeLandedRecord({...complete,canonicalProductId:'not-a-uuid',productName:'Display label'});
  assert.equal(r.canonicalProductId,null);
  assert.equal(r.decisionEligible,false);
  assert.equal(r.confirmed,false);
});
