import assert from 'node:assert/strict';
import test from 'node:test';
import { highestAllowedStatus, normalizePurchaseRecord, purchaseBlockers, purchaseEconomics, supplierReady } from '../purchase-manager.js';

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

test('purchase economics uses confirmed target cost when available',()=>{
  const e=purchaseEconomics({landed:70,sell:200},{quantity:10,targetUnitCost:55},{});
  assert.equal(e.orderValue,550);
  assert.equal(e.revenue,2000);
});
