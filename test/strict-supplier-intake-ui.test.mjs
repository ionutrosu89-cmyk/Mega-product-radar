import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {verifySupplierQuote} from '../supplier-quote-verifier.js';
import {evaluateCommercialDecision} from '../commercial-decision-engine.js';

const completeQuote={
  productCanonicalKey:'car-sunglasses-magnetic-visor-holder',supplierName:'Example Supplier',platform:'Alibaba',sourceUrl:'https://example.com/direct-item',supplierSkuOrModel:'VISOR-MAG-01',exactProductConfirmed:true,
  unitPrice:0.72,currency:'USD',quoteQuantity:100,moq:20,sampleCost:2,sampleShippingToRomania:15,leadTimeDays:12,incoterm:'EXW',bulkShippingToRomania:35,shippingCurrency:'USD',
  cartonQuantity:100,cartonGrossWeightKg:8,cartonLengthCm:45,cartonWidthCm:30,cartonHeightCm:25,paymentTerms:'30/70',tradeAssuranceOrEquivalent:true,inspectionAccepted:true,
  complianceStatus:'NOT_APPLICABLE',complianceEvidence:[],complianceNotApplicableBasis:'Reviewed product scope and applicable EU requirements; no product-specific conformity marking requirement identified. Basis recorded by verifier.',quotedAt:'2026-08-24T06:00:00Z',quoteValidUntil:'2026-09-24T06:00:00Z',manualVerifiedAt:'2026-08-24T06:05:00Z',manualVerifiedBy:'operator'
};

test('shared quote verifier stays fail-closed and accepts only complete manually verified evidence',()=>{
  assert.equal(verifySupplierQuote(completeQuote).verified,true);
  assert.equal(verifySupplierQuote({...completeQuote,bulkShippingToRomania:null}).verified,false);
  assert.equal(verifySupplierQuote({...completeQuote,manualVerifiedAt:''}).verified,false);
  assert.equal(verifySupplierQuote({...completeQuote,sourceUrl:'search results'}).verified,false);
});

test('strict supplier quote can pass Supplier Gate in original currency but cannot create landed economics',()=>{
  const p={name:'Car sunglasses magnetic visor holder',commercialHardening:{gates:{}},romaniaDemand:{readyForTestDemandGate:true},salesEstimation:{status:'ESTIMATED_HIGH_CONFIDENCE',estimatedUnits30d:1000,confidence:100},launchScore:{enoughEvidence:true},evidenceCoverage:{evidenceReady:true},competitors:{evidenceMarkets:2},dataConfidence:{overall:60},trendIntelligence:{status:'STABLE'},profitEngineV2:{derivedSalePrice:44.74}};
  const state={supplierRecords:{'car sunglasses magnetic visor holder':{productName:p.name,commercialVerified:true,strictQuote:completeQuote}},landedCosts:{}};
  const d=evaluateCommercialDecision(p,state);
  assert.equal(d.gates.supplierVerified,true);
  assert.equal(d.landedCostConfirmed,false);
  assert.equal(d.gates.economicsHealthy,false);
  assert.equal(d.commercialAction,'HOLD');
});

test('Supplier Intelligence UI uses the shared strict verifier and Netlify ships it',async()=>{
  const [ui,html,build]=await Promise.all([
    fs.readFile(new URL('../supplier-intelligence.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../supplier-intelligence.html',import.meta.url),'utf8'),
    fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8')
  ]);
  assert.match(ui,/supplier-quote-verifier\.js/);
  assert.match(ui,/verifySupplierQuote\(quote\)/);
  assert.doesNotMatch(ui,/commercialVerified=Boolean\(url/);
  for(const id of ['sku','quoteQty','sampleShipping','incoterm','bulkShipping','shippingCurrency','cartonQty','cartonWeight','payment','inspection','compliance','complianceBasis','quotedAt','validUntil','verifiedBy','manualConfirm'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(build,/supplier-quote-verifier\.js/);
});
