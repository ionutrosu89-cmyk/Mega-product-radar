import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLandedEconomics } from '../landed-economics-v1.js';

test('fails closed when supplier or Romania evidence is not verified',()=>{
  const r=calculateLandedEconomics({});
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.confirmedLandedEconomics,false);
  assert.equal(r.landedCostPerSet,null);
  assert.ok(r.blockers.includes('SUPPLIER_PACKAGE_NOT_VERIFIED'));
  assert.ok(r.blockers.includes('ROMANIA_GAP_NOT_EXACT'));
  assert.equal(r.purchaseAuthorized,false);
});

test('null numeric input remains unknown and is never coerced to zero',()=>{
  const r=calculateLandedEconomics({supplierPackageVerified:true,romaniaGapExact:true,goodsValueRon:null});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('MISSING_GOODSVALUERON'));
  assert.equal(r.landedCostPerSet,null);
});

test('foreign-currency quote requires explicit FX rate and source',()=>{
  const base={supplierPackageVerified:true,romaniaGapExact:true,quoteCurrency:'USD',sellableSets:100,goodsValueRon:5000,internationalFreightRon:1000,insuranceRon:50,dutyRate:.12,importVatRate:.21,importVatAdditionalBaseRon:200,brokerageRon:100,destinationHandlingRon:100,domesticTransportRon:100,complianceRon:100,sellPriceGrossRon:200,sellVatRate:.21,marketplaceCommissionRate:.15,fulfillmentPerSetRon:15,adsReserveRate:.05,returnsReserveRate:.03,otherReserveRate:.02,importVatRecoverable:true,freightEvidenceRef:'quote',dutyEvidenceRef:'taric',importVatBaseEvidenceRef:'customs-treatment',sellPriceEvidenceRef:'market'};
  const r=calculateLandedEconomics(base);
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('FX_RATE_REQUIRED'));
  assert.ok(r.blockers.includes('FX_SOURCE_REQUIRED'));
});

test('calculates landed economics only with complete verified inputs',()=>{
  const r=calculateLandedEconomics({
    supplierPackageVerified:true,romaniaGapExact:true,quoteCurrency:'RON',sellableSets:100,
    goodsValueRon:5000,internationalFreightRon:1000,insuranceRon:50,dutyRate:.12,importVatRate:.21,importVatAdditionalBaseRon:200,
    brokerageRon:100,destinationHandlingRon:100,domesticTransportRon:100,complianceRon:100,
    sellPriceGrossRon:200,sellVatRate:.21,marketplaceCommissionRate:.15,fulfillmentPerSetRon:15,
    adsReserveRate:.05,returnsReserveRate:.03,otherReserveRate:.02,importVatRecoverable:true,
    freightEvidenceRef:'verified-freight',dutyEvidenceRef:'verified-taric',importVatBaseEvidenceRef:'verified-customs-treatment',sellPriceEvidenceRef:'verified-market'
  });
  assert.equal(r.status,'CONFIRMED');
  assert.equal(r.confirmedLandedEconomics,true);
  assert.equal(r.customsValueRon,6050);
  assert.equal(r.customsDutyRon,726);
  assert.equal(r.importVatBaseRon,6976);
  assert.equal(r.importVatRon,1464.96);
  assert.equal(r.cashLandedCostPerSet,86.41);
  assert.equal(r.landedCostPerSet,71.76);
  assert.ok(r.profitPerSet>0);
  assert.ok(r.margin>0);
  assert.ok(r.roi>0);
  assert.ok(r.breakEvenSellPriceGrossRon>0);
  assert.equal(r.verifiedSales,false);
  assert.equal(r.purchaseAuthorized,false);
});
