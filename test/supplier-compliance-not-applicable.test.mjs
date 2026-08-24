import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySupplierQuote} from '../supplier-quote-verifier.js';
import fs from 'node:fs/promises';

const base={
  productCanonicalKey:'demo-product',supplierName:'Demo Supplier',platform:'Alibaba',sourceUrl:'https://example.com/quote',supplierSkuOrModel:'SKU-1',exactProductConfirmed:true,
  unitPrice:1,currency:'USD',quoteQuantity:30,moq:1,sampleCost:0,sampleShippingToRomania:0,leadTimeDays:3,incoterm:'DDP',bulkShippingToRomania:10,shippingCurrency:'USD',
  cartonQuantity:30,cartonGrossWeightKg:5,cartonLengthCm:40,cartonWidthCm:30,cartonHeightCm:20,paymentTerms:'Trade Assurance',tradeAssuranceOrEquivalent:true,inspectionAccepted:true,
  quotedAt:'2026-08-24T06:00:00Z',quoteValidUntil:'2026-08-31T06:00:00Z',manualVerifiedAt:'2026-08-24T06:10:00Z',manualVerifiedBy:'Reviewer'
};

test('NOT_APPLICABLE compliance fails closed without an explicit reviewed basis',()=>{
  const v=verifySupplierQuote({...base,complianceStatus:'NOT_APPLICABLE',complianceEvidence:[]});
  assert.equal(v.verified,false);
  assert.ok(v.blockers.includes('explicit compliance not-applicable basis'));
});

test('NOT_APPLICABLE compliance may pass only when an explicit basis is recorded',()=>{
  const v=verifySupplierQuote({...base,complianceStatus:'NOT_APPLICABLE',complianceEvidence:[],complianceNotApplicableBasis:'Reviewed product scope against applicable EU product rules; no CE directive identified for this passive mechanical holder. Review source and responsible verifier recorded in dossier.'});
  assert.equal(v.verified,true);
});

test('PROVIDED compliance still requires actual evidence references',()=>{
  const v=verifySupplierQuote({...base,complianceStatus:'PROVIDED',complianceEvidence:[]});
  assert.equal(v.verified,false);
  assert.ok(v.blockers.includes('compliance evidence files/references'));
});

test('Supplier Intake exposes and persists compliance basis',async()=>{
  const html=await fs.readFile('supplier-intelligence.html','utf8');
  const js=await fs.readFile('supplier-intelligence.js','utf8');
  assert.match(html,/id="complianceBasis"/);
  assert.match(js,/complianceNotApplicableBasis:value\('#complianceBasis'\)/);
});
