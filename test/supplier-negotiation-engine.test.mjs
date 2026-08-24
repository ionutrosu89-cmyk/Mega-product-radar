import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateQuoteNegotiation,rankNegotiationQuotes} from '../supplier-negotiation-engine.js';

const baseQuote={
  productCanonicalKey:'car sunglasses magnetic visor holder',supplierName:'Supplier A',platform:'Alibaba',sourceUrl:'https://example.com/quote-a',supplierSkuOrModel:'MAG-01',exactProductConfirmed:true,
  unitPrice:0.5,currency:'USD',quoteQuantity:100,moq:20,sampleCost:1,sampleShippingToRomania:8,leadTimeDays:10,incoterm:'DAP',bulkShippingToRomania:20,shippingCurrency:'USD',
  cartonQuantity:100,cartonGrossWeightKg:8,cartonLengthCm:40,cartonWidthCm:30,cartonHeightCm:25,paymentTerms:'30/70',tradeAssuranceOrEquivalent:true,inspectionAccepted:true,
  complianceStatus:'NOT_APPLICABLE',complianceEvidence:[],quotedAt:'2026-08-24T06:00:00Z',quoteValidUntil:'2026-09-24T06:00:00Z',manualVerifiedAt:'2026-08-24T06:05:00Z',manualVerifiedBy:'operator'
};

test('incomplete quote never reaches economics screening',()=>{
  const x=evaluateQuoteNegotiation({...baseQuote,bulkShippingToRomania:null},{sellPriceRon:44.74,fxToRon:{USD:4.6}});
  assert.equal(x.status,'QUOTE_INCOMPLETE');
  assert.equal(x.confirmedLandedCost,false);
  assert.equal(x.testPermission,false);
});

test('foreign-currency quote requires explicit FX and never assumes rate',()=>{
  const x=evaluateQuoteNegotiation(baseQuote,{sellPriceRon:44.74,fxToRon:{}});
  assert.equal(x.status,'FX_REQUIRED');
  assert.equal(x.screening,undefined);
});

test('quote below direct-cost ceiling is only potentially feasible, never confirmed landed',()=>{
  const x=evaluateQuoteNegotiation(baseQuote,{sellPriceRon:44.74,fxToRon:{USD:4.6}});
  assert.equal(x.status,'POTENTIALLY_FEASIBLE_PENDING_LANDED_COST');
  assert.equal(x.confirmedLandedCost,false);
  assert.equal(x.testPermission,false);
  assert.ok(x.screening.headroomRon>0);
});

test('slightly over ceiling generates negotiate-down target',()=>{
  const q={...baseQuote,unitPrice:0.65,bulkShippingToRomania:20};
  const x=evaluateQuoteNegotiation(q,{sellPriceRon:44.74,fxToRon:{USD:4.6}});
  assert.equal(x.status,'NEGOTIATE_DOWN');
  assert.ok(x.screening.maxUnitPriceInQuoteCurrency>=0);
  assert.match(x.action,/Negociază/);
});

test('far over ceiling rejects economics before customs are even added',()=>{
  const q={...baseQuote,unitPrice:1.5,bulkShippingToRomania:100};
  const x=evaluateQuoteNegotiation(q,{sellPriceRon:44.74,fxToRon:{USD:4.6}});
  assert.equal(x.status,'REJECT_ECONOMICS');
  assert.equal(x.confirmedLandedCost,false);
});

test('ranking prefers verified potentially feasible quote with most headroom',()=>{
  const quotes=[
    {...baseQuote,supplierName:'B',unitPrice:0.6},
    {...baseQuote,supplierName:'A',unitPrice:0.4},
    {...baseQuote,supplierName:'C',unitPrice:1.6,bulkShippingToRomania:100}
  ];
  const ranked=rankNegotiationQuotes(quotes,{sellPriceRon:44.74,fxToRon:{USD:4.6}});
  assert.equal(ranked[0].supplierName,'A');
  assert.equal(ranked.at(-1).status,'REJECT_ECONOMICS');
});
