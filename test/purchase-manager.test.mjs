import assert from 'node:assert/strict';
import test from 'node:test';
import { highestAllowedStatus, normalizePurchaseRecord, promotedDiscoveryProducts, purchaseBlockers, purchaseEconomics, supplierReady } from '../purchase-manager.js';

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

test('complete checklist reaches READY TO ORDER and order reference reaches COMANDAT',()=>{
  const s={supplierName:'A',moq:20,rating:4.7,years:4,tradeAssurance:true};
  const ready={quantity:20,sampleOrdered:true,sampleApproved:true,complianceDocs:true,packagingConfirmed:true,landedCostConfirmed:true,paymentTermsConfirmed:true};
  assert.equal(highestAllowedStatus(ready,s),'READY TO ORDER');
  assert.equal(highestAllowedStatus({...ready,orderNumber:'PO-123'},s),'COMANDAT');
});

test('confirmed Landed Cost satisfies landed checklist automatically',()=>{
  const s={supplierName:'A',moq:20,rating:4.7,years:4,tradeAssurance:true};
  const ready={quantity:20,sampleOrdered:true,sampleApproved:true,complianceDocs:true,packagingConfirmed:true,paymentTermsConfirmed:true};
  const landed={currency:'USD',fxRate:5,unitPriceForeign:10,quantity:20,confirmed:true};
  assert.equal(highestAllowedStatus(ready,s,landed),'READY TO ORDER');
  assert.ok(!purchaseBlockers(ready,s,landed).some(x=>x.includes('Landed cost')));
});

test('purchase economics prefers confirmed Landed Cost over manual target',()=>{
  const landed={currency:'USD',fxRate:5,unitPriceForeign:10,quantity:10,internationalFreight:100,confirmed:true};
  const e=purchaseEconomics({landed:70,sell:200},{quantity:10,targetUnitCost:55},{},landed);
  assert.equal(e.unitCost,60);
  assert.equal(e.orderValue,600);
  assert.equal(e.costSource,'CONFIRMAT 4.4');
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
