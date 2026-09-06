import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLandedInputFromVerifiedQuote} from '../scripts/verified-quote-to-landed-input.mjs';

const verifiedQuote={
  verified:true,
  evidenceStatus:'MANUALLY_VERIFIED_QUOTE',
  landedCostEligible:true,
  productCanonicalKey:'car-sunglasses-magnetic-visor-holder',
  supplierName:'Example Supplier',
  sourceUrl:'https://example.com/item/123',
  manualVerifiedAt:'2026-08-23T12:00:00Z',
  unitPrice:0.8,
  currency:'USD',
  quoteQuantity:100,
  bulkShippingToRomania:45,
  shippingCurrency:'USD',
  incoterm:'FOB'
};

const supplierPage={
  supplierPageObserved:true,
  evidenceStatus:'SUPPLIER_PAGE_OBSERVED',
  productCanonicalKey:'car-sunglasses-magnetic-visor-holder',
  supplierName:'Example Supplier',
  sourceUrl:'https://example.com/product/123',
  unitPrice:0.72,
  currency:'USD',
  moq:50,
  productLengthCm:12,
  productWidthCm:4,
  productHeightCm:3,
  actualGrossWeightKg:0.18
};

test('verified quote seeds simulation only and never confirmed landed cost',()=>{
  const result=buildLandedInputFromVerifiedQuote(verifiedQuote);
  assert.equal(result.ready,true);
  assert.equal(result.status,'LANDED_INPUT_READY_SIMULATION_ONLY');
  assert.equal(result.landedInput.confirmed,false);
  assert.equal(result.landedInput.fxRate,null);
  assert.equal(result.landedInput.customsDutyRate,null);
  assert.equal(result.landedInput.marketCode,'RO');
  assert.equal(result.landedInput.importVatRatePct,21);
  assert.equal(result.landedInput.freightMode,'QUOTE_TOTAL');
  assert.ok(result.landedInput.missingForConfirmedLandedCost.length>=5);
});

test('exact supplier product page can seed page-backed landed screening without supplier contact',()=>{
  const result=buildLandedInputFromVerifiedQuote(supplierPage);
  assert.equal(result.ready,true);
  assert.equal(result.status,'PAGE_BACKED_LANDED_SCREENING_READY');
  assert.equal(result.landedInput.confirmed,false);
  assert.equal(result.landedInput.screeningEligible,true);
  assert.equal(result.landedInput.supplierContactRequired,false);
  assert.equal(result.landedInput.userApprovalRequiredBeforeSampleOrOrder,true);
  assert.equal(result.landedInput.freightMode,'CARRIER_ESTIMATE_REQUIRED');
  assert.equal(result.landedInput.transportSource,'DHL_FEDEX_UPS_ESTIMATE');
  assert.equal(result.landedInput.importVatRatePct,21);
});

test('generic unverified public data still cannot enter landed screening',()=>{
  const result=buildLandedInputFromVerifiedQuote({...verifiedQuote,verified:false,evidenceStatus:'UNVERIFIED_PUBLIC_LISTING',landedCostEligible:false});
  assert.equal(result.ready,false);
  assert.equal(result.landedInput,null);
  assert.ok(result.blockers.includes('evidence must be a manually verified quote or an exact observed supplier product page'));
});

test('supplier page without freight remains eligible for carrier-estimated screening',()=>{
  const result=buildLandedInputFromVerifiedQuote(supplierPage);
  assert.equal(result.ready,true);
  assert.equal(result.landedInput.internationalFreightForeign,null);
  assert.ok(result.warnings.some(x=>x.includes('freight quote')));
});

test('missing shipping remains unknown and blocks verified-quote bridge',()=>{
  const result=buildLandedInputFromVerifiedQuote({...verifiedQuote,bulkShippingToRomania:null});
  assert.equal(result.ready,false);
  assert.ok(result.blockers.includes('verified Romania shipping missing'));
});

test('mixed quote and shipping currencies require explicit conversion',()=>{
  const result=buildLandedInputFromVerifiedQuote({...verifiedQuote,shippingCurrency:'EUR'});
  assert.equal(result.ready,false);
  assert.ok(result.blockers.includes('mixed currencies require explicit conversion before landed-cost input'));
});
