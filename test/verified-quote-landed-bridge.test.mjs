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

test('verified quote seeds simulation only and never confirmed landed cost',()=>{
  const result=buildLandedInputFromVerifiedQuote(verifiedQuote);
  assert.equal(result.ready,true);
  assert.equal(result.status,'LANDED_INPUT_READY_SIMULATION_ONLY');
  assert.equal(result.landedInput.confirmed,false);
  assert.equal(result.landedInput.fxRate,null);
  assert.equal(result.landedInput.customsDutyRate,null);
  assert.ok(result.landedInput.missingForConfirmedLandedCost.length>=5);
});

test('unverified public data cannot enter landed cost bridge',()=>{
  const result=buildLandedInputFromVerifiedQuote({...verifiedQuote,verified:false,evidenceStatus:'UNVERIFIED_PUBLIC_LISTING',landedCostEligible:false});
  assert.equal(result.ready,false);
  assert.equal(result.landedInput,null);
  assert.ok(result.blockers.includes('quote is not verified'));
});

test('missing shipping remains unknown and blocks bridge',()=>{
  const result=buildLandedInputFromVerifiedQuote({...verifiedQuote,bulkShippingToRomania:null});
  assert.equal(result.ready,false);
  assert.ok(result.blockers.includes('verified Romania shipping missing'));
});

test('mixed quote and shipping currencies require explicit conversion',()=>{
  const result=buildLandedInputFromVerifiedQuote({...verifiedQuote,shippingCurrency:'EUR'});
  assert.equal(result.ready,false);
  assert.ok(result.blockers.includes('mixed currencies require explicit conversion before landed-cost input'));
});
