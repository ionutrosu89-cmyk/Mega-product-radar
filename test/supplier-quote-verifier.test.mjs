import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySupplierQuote} from '../scripts/supplier-quote-verifier.mjs';

const complete={
  productCanonicalKey:'under-desk-headphone-hanger-clamp',
  supplierName:'Example Supplier',platform:'Alibaba',sourceUrl:'https://example.com/product/123',supplierSkuOrModel:'ABC-123',exactProductConfirmed:true,
  unitPrice:1.2,currency:'USD',quoteQuantity:100,moq:20,sampleCost:2,sampleShippingToRomania:12,leadTimeDays:10,incoterm:'FOB',bulkShippingToRomania:45,shippingCurrency:'USD',
  cartonQuantity:100,cartonGrossWeightKg:12,cartonLengthCm:50,cartonWidthCm:40,cartonHeightCm:35,paymentTerms:'30% deposit / 70% before shipment',tradeAssuranceOrEquivalent:true,inspectionAccepted:true,
  complianceStatus:'NOT_APPLICABLE',complianceEvidence:[],complianceNotApplicableBasis:'Reviewed product scope and applicable EU requirements; no product-specific conformity marking requirement identified. Basis recorded by verifier.',quotedAt:'2026-08-23T10:00:00Z',quoteValidUntil:'2026-09-06T10:00:00Z',manualVerifiedAt:'2026-08-23T11:00:00Z',manualVerifiedBy:'admin'
};

test('complete direct manually verified quote can become landed-cost eligible',()=>{
  const result=verifySupplierQuote(complete);
  assert.equal(result.verified,true);
  assert.equal(result.evidenceStatus,'MANUALLY_VERIFIED_QUOTE');
  assert.equal(result.landedCostEligible,true);
  assert.deepEqual(result.blockers,[]);
});

test('public price-like data without quote evidence fails closed',()=>{
  const result=verifySupplierQuote({productCanonicalKey:'under-desk-headphone-hanger-clamp',supplierName:'Public Listing',unitPrice:0.1,currency:'USD',moq:20});
  assert.equal(result.verified,false);
  assert.equal(result.landedCostEligible,false);
  assert.ok(result.blockers.includes('direct source URL'));
  assert.ok(result.blockers.includes('supplier freight quote or carrier-ready logistics'));
  assert.ok(result.blockers.includes('manual verification timestamp'));
});

test('missing compliance evidence blocks when supplier says evidence is provided',()=>{
  const result=verifySupplierQuote({...complete,complianceStatus:'PROVIDED',complianceEvidence:[]});
  assert.equal(result.verified,false);
  assert.ok(result.blockers.includes('compliance evidence files/references'));
});

test('supplier freight may be omitted when carrier-ready carton logistics are verified',()=>{
  const result=verifySupplierQuote({...complete,bulkShippingToRomania:null,shippingCurrency:null});
  assert.equal(result.verified,true);
  assert.equal(result.landedCostEligible,true);
});

test('missing supplier freight and missing carrier-ready logistics fail closed',()=>{
  const result=verifySupplierQuote({...complete,bulkShippingToRomania:null,shippingCurrency:null,cartonGrossWeightKg:null});
  assert.equal(result.verified,false);
  assert.equal(result.landedCostEligible,false);
  assert.ok(result.blockers.includes('carton gross weight'));
  assert.ok(result.blockers.includes('supplier freight quote or carrier-ready logistics'));
});
