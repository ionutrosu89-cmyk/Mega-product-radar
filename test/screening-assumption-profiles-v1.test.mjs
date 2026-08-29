import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFreightEstimate,resolveDutyTaxProfile,resolveMarketplaceFeeProfile} from '../screening-assumption-profiles-v1.js';

test('freight uses max of actual and volumetric weight',()=>{
  const r=resolveFreightEstimate({actualWeightKg:1,volumeCm3:12000,volumetricDivisor:5000,ratePerKgRon:20,minimumPerUnitRon:10,sourceRef:'carrier-profile:v1',confidence:'MEDIUM'});
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.method,'WEIGHT_OR_VOLUMETRIC');
  assert.equal(r.chargeableWeightKg,2.4);
  assert.equal(r.value,48);
});

test('freight category fallback is explicit and provenance-backed',()=>{
  const r=resolveFreightEstimate({categoryFallbackPerUnitRon:18,sourceRef:'fallback:softgoods-v1',confidence:'LOW'});
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.method,'CATEGORY_FALLBACK');
  assert.equal(r.value,18);
  assert.equal(r.truthPolicy.assumptionIsQuote,false);
});

test('freight unknown does not become zero',()=>{
  const r=resolveFreightEstimate({sourceRef:'x',confidence:'LOW'});
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.value,null);
  assert.ok(r.blockers.includes('FREIGHT_ESTIMATE_UNRESOLVED'));
});

test('duty tax profile requires explicit source and valid rates',()=>{
  const r=resolveDutyTaxProfile({dutyRate:0.12,importVatRate:0.21,classificationRef:'cn:provisional',classificationConfirmed:false,sourceRef:'taric-screening:2026-08-29',confidence:'MEDIUM'});
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.value.dutyRate,0.12);
  assert.equal(r.truthPolicy.classificationConfirmed,false);
});

test('marketplace fee profile preserves reserves and does not claim confirmed fee',()=>{
  const r=resolveMarketplaceFeeProfile({commissionRate:0.18,fulfillmentPerUnitRon:8,adsReserveRate:0.06,returnsReserveRate:0.04,warrantyReserveRate:0.01,otherReserveRate:0.01,sourceRef:'fees:marketplace-v1',confidence:'MEDIUM'});
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.value.marketplaceCommissionRate,0.18);
  assert.equal(r.truthPolicy.assumptionIsConfirmedFee,false);
});
