import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSupplierPageScreeningInput} from '../scripts/supplier-page-to-landed-input.mjs';

const davis={
  productCanonicalKey:'car-sunglasses-magnetic-visor-holder',
  supplierName:'Ningbo Desheng Imp. & Exp. Co., Ltd.',
  sourceUrl:'https://www.alibaba.com/pla/Magnetic-Leather-Multi-Functional-Car-Sun_1601595129899.html',
  unitPrice:0.75,
  currency:'USD',
  quoteQuantity:30,
  totalProductPrice:22.5,
  bulkShippingToRomania:40,
  quotedTotalDdp:62.5,
  incoterm:'DDP',
  cartonQuantity:30,
  cartonGrossWeightKg:1.7,
  cartonLengthCm:30,
  cartonWidthCm:20,
  cartonHeightCm:10,
  evidenceStatus:'QUOTE_INCOMPLETE',
  directProductPageEvidence:{
    publicPriceRangeUsd:[0.64,0.75],
    publicMoq:2,
    supplierName:'Ningbo Desheng Imp. & Exp. Co., Ltd.'
  }
};

test('supplier page is sufficient for screening without becoming a verified quote',()=>{
  const r=buildSupplierPageScreeningInput(davis,'DHL_EXPRESS');
  assert.equal(r.status,'PAGE_BACKED_SCREENING_READY');
  assert.equal(r.commercialQuoteSubstitute,false);
  assert.equal(r.supplierContactRequired,false);
  assert.equal(r.userApprovalRequiredBeforeSampleOrOrder,true);
  assert.equal(r.publicUnitPrice,0.75);
  assert.equal(r.publicMoq,2);
  assert.equal(r.importVatRatePct,21);
});

test('chargeable weight uses the greater of actual and volumetric weight',()=>{
  const r=buildSupplierPageScreeningInput(davis,'DHL_EXPRESS');
  assert.equal(r.logistics.volumetricDivisorCm3PerKg,5000);
  assert.equal(r.logistics.volumetricWeightKg,1.2);
  assert.equal(r.logistics.actualGrossWeightKg,1.7);
  assert.equal(r.logistics.chargeableWeightKg,1.7);
  assert.equal(r.logistics.chargingRule,'MAX_ACTUAL_OR_VOLUMETRIC');
});

test('missing page price or MOQ fails screening closed',()=>{
  const r=buildSupplierPageScreeningInput({...davis,directProductPageEvidence:{supplierName:davis.supplierName}});
  assert.equal(r.status,'BLOCKED_INSUFFICIENT_PAGE_EVIDENCE');
  assert.ok(r.blockers.includes('PUBLIC_MOQ_MISSING'));
});
