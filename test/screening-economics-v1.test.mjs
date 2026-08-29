import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';

const complete={supplierUnitPriceRon:25,sellPriceGrossRon:119.99,freightPerUnitRon:6,insurancePerUnitRon:0.5,dutyRate:0.12,importVatRate:0.21,importVatRecoverable:true,importVatAdditionalBasePerUnitRon:1,brokeragePerUnitRon:1.5,destinationHandlingPerUnitRon:1,domesticTransportPerUnitRon:1.5,packagingPerUnitRon:1,complianceReservePerUnitRon:0.75,sellVatRate:0.21,marketplaceCommissionRate:0.18,fulfillmentPerUnitRon:8,adsReserveRate:0.06,returnsReserveRate:0.04,warrantyReserveRate:0.01,otherReserveRate:0.01,targetProfitPerUnitRon:10,matchConfidence:91,supplierPriceEvidenceRef:'supplier-ledger:abc',marketplacePriceEvidenceRef:'marketplace-ledger:def',freightAssumptionRef:'profile:small-parcel-v1',dutyAssumptionRef:'taric:screening-profile-v1',marketplaceFeeAssumptionRef:'fees:marketplace-v1'};

test('missing/null values fail closed and never become zero',()=>{
  const r=calculateScreeningEconomics({...complete,freightPerUnitRon:null});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('MISSING_FREIGHTPERUNITRON'));
  assert.equal(r.scenarios,null);
});

test('match confidence below 80 blocks economics screening',()=>{
  const r=calculateScreeningEconomics({...complete,matchConfidence:79});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('MATCH_CONFIDENCE_BELOW_80'));
});

test('complete screening creates best/base/conservative and ranks conservative',()=>{
  const r=calculateScreeningEconomics(complete);
  assert.equal(r.status,'SCREENED');
  assert.equal(r.evidenceClass,'SCREENING_ESTIMATE');
  assert.equal(r.confirmedLandedEconomics,false);
  assert.equal(r.rankingScenario,'CONSERVATIVE');
  assert.ok(r.scenarios.best.landedCostPerUnitRon<r.scenarios.base.landedCostPerUnitRon);
  assert.ok(r.scenarios.base.landedCostPerUnitRon<r.scenarios.conservative.landedCostPerUnitRon);
  assert.ok(r.scenarios.conservative.profitPerUnitRon<r.scenarios.base.profitPerUnitRon);
  assert.equal(r.truthPolicy.publicSupplierListingIsVerifiedQuote,false);
  assert.equal(r.truthPolicy.marketplacePriceIsRealizedSale,false);
});

test('maximum viable inputs and break-even are produced deterministically',()=>{
  const a=calculateScreeningEconomics(complete);
  const b=calculateScreeningEconomics(complete);
  assert.deepEqual(a,b);
  assert.ok(Number.isFinite(a.scenarios.conservative.breakEvenSellPriceGrossRon));
  assert.ok(Number.isFinite(a.scenarios.conservative.maximumViableSupplierPriceRon));
  assert.ok(Number.isFinite(a.scenarios.conservative.maximumViableFreightPerUnitRon));
});

test('confirmed landed economics can never be claimed by screening estimator',()=>{
  const r=calculateScreeningEconomics({...complete,confirmedLandedEconomics:true,supplierPackageVerified:true});
  assert.equal(r.confirmedLandedEconomics,false);
  assert.equal(r.evidenceClass,'SCREENING_ESTIMATE');
  assert.equal(r.verifiedSales,false);
  assert.equal(r.purchaseAuthorized,false);
});
