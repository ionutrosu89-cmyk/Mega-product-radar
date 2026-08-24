import assert from 'node:assert/strict';
import test from 'node:test';
import { highestAllowedStatus, normalizePurchaseRecord, promotedDiscoveryProducts, purchaseBlockers, purchaseEconomics, supplierReady } from '../purchase-manager.js';

const supplied={fxRate:true,unitPriceForeign:true,quantity:true,internationalFreight:true,customsDutyRate:true,customsFixed:true,brokerage:true,domesticFreight:true,inspection:true,labelsPackaging:true,otherFixed:true};
const confirmedLanded=(overrides={})=>({currency:'USD',fxRate:5,unitPriceForeign:10,quantity:10,internationalFreight:100,customsDutyRate:0,customsFixed:0,brokerage:0,domesticFreight:0,inspection:0,labelsPackaging:0,otherFixed:0,provided:supplied,fxSource:'bank statement',fxVerifiedAt:'2026-08-24T06:00:00Z',customsStatus:'NOT_APPLICABLE',importVatTreatment:'DEDUCTIBLE_EXCLUDED_FROM_COST',freightEvidenceRef:'freight quote F-1',supplierQuoteRef:'supplier quote Q-1',manualVerifiedBy:'operator',manualVerifiedAt:'2026-08-24T06:05:00Z',confirmationRequested:true,...overrides});

test('purchase record normalizes numeric and boolean fields',()=>{
  const r=normalizePurchaseRecord({status:'READY TO ORDER',quantity:'12.7',targetUnitCost:'44.5',sampleOrdered:1,sampleApproved:true});
  assert.equal(r.quantity,13);
  assert.equal(r.targetUnitCost,44.5);
  assert.equal(r.sampleOrdered,true);
  assert.equal(r.status,'READY TO ORDER');
});

test('supplier is ready only with commercial verification criteria',()=>{
  assert.equal(supplierReady({supplierName:'A',moq:20,rating:4.7,years:4,tradeAssurance:true}),true);
  assert.equal(supplierReady({supplierName:'A',moq:20,rating:4.1,years:4,tradeAssurance:true}),false);
});

test('READY TO ORDER is blocked until checklist and MOQ are complete',()=>{
  const s={supplierName:'A',moq:20,rating:4.7,years:4,tradeAssurance:true};
  const incomplete={quantity:10,sampleOrdered:true,sampleApproved:true};
  assert.notEqual(highestAllowedStatus(incomplete,s),'READY TO ORDER');
  assert.ok(purchaseBlockers(incomplete,s).some(x=>x.includes('MOQ')));
});

test('legacy manual landed checkbox cannot reach READY TO ORDER without evidence-confirmed landed record',()=>{
  const s={supplierName:'A',moq:20,rating:4.7,years:4,tradeAssurance:true};
  const ready={quantity:20,sampleOrdered:true,sampleApproved:true,complianceDocs:true,packagingConfirmed:true,landedCostConfirmed:true,paymentTermsConfirmed:true};
  assert.equal(highestAllowedStatus(ready,s),'APROBAT');
  assert.ok(purchaseBlockers(ready,s).some(x=>x.includes('Landed cost')));
});

test('evidence-confirmed Landed Cost satisfies landed checklist automatically',()=>{
  const s={supplierName:'A',moq:20,rating:4.7,years:4,tradeAssurance:true};
  const ready={quantity:20,sampleOrdered:true,sampleApproved:true,complianceDocs:true,packagingConfirmed:true,paymentTermsConfirmed:true};
  const landed=confirmedLanded({quantity:20,internationalFreight:200});
  assert.equal(highestAllowedStatus(ready,s,landed),'READY TO ORDER');
  assert.ok(!purchaseBlockers(ready,s,landed).some(x=>x.includes('Landed cost')));
  assert.equal(highestAllowedStatus({...ready,orderNumber:'PO-123'},s,landed),'COMANDAT');
});

test('purchase economics prefers evidence-confirmed Landed Cost over manual target',()=>{
  const landed=confirmedLanded();
  const e=purchaseEconomics({landed:70,sell:200},{quantity:10,targetUnitCost:55},{},landed);
  assert.equal(e.unitCost,60);
  assert.equal(e.orderValue,600);
  assert.equal(e.costSource,'CONFIRMAT 4.5');
});

test('only validated BUY CANDIDATE discovery products enter Purchase Manager',()=>{
  const strong={name:'Discovery A',cat:'Travel',sellTarget:329,landedEstimate:60,checks:8,foreignPresence:3,chinaPresence:2,romaniaPresence:0,foreignResults:24,chinaResults:16,romaniaResults:0,socialResults:22};
  const weak={...strong,name:'Discovery B',checks:2};
  const records={'discovery a':{stage:'BUY CANDIDATE',updatedAt:'now'},'discovery b':{stage:'BUY CANDIDATE',updatedAt:'now'}};
  const promoted=promotedDiscoveryProducts([strong,weak],records);
  assert.equal(promoted.length,1);
  assert.equal(promoted[0].name,'Discovery A');
  assert.equal(promoted[0].discoveryCandidate,true);
  assert.equal(promoted[0].sell,329);
  assert.equal(promoted[0].landed,60);
});
