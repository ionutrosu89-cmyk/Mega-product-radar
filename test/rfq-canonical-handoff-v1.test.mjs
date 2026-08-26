import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRfqRecord,followUpStatus,markRfqSent,markRfqReplied,seedRfqRecords} from '../rfq-dispatch-state.js';

const ID='123e4567-e89b-42d3-a456-426614174000';

test('legacy RFQ remains operational but cannot hand off to decision gates',()=>{
  const r=normalizeRfqRecord({productKey:'legacy-key',productName:'Display title',supplierName:'Supplier A',platform:'Alibaba'});
  assert.equal(r.canonicalProductId,null);
  assert.equal(r.decisionHandoffEligible,false);
  assert.equal(r.identityStatus,'LEGACY_LABEL_ONLY');
});

test('canonical RFQ preserves identity through sent and replied transitions',()=>{
  const base=normalizeRfqRecord({canonicalProductId:ID,productKey:'legacy-key',productName:'Display title',supplierName:'Supplier A',platform:'Alibaba'});
  const sent=markRfqSent(base,{confirmedRealDispatch:true,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-26T10:00:00Z'});
  assert.equal(sent.ok,true);
  assert.equal(sent.record.canonicalProductId,ID);
  assert.equal(sent.record.decisionHandoffEligible,true);
  const replied=markRfqReplied(sent.record,{confirmedRealResponse:true,responseReference:'msg-1',responseReceivedAt:'2026-08-26T12:00:00Z'});
  assert.equal(replied.ok,true);
  assert.equal(replied.record.canonicalProductId,ID);
  assert.equal(followUpStatus(replied.record,'2026-08-26T13:00:00Z').nextAction,'Deschide Quote Intake și verifică răspunsul.');
});

test('reply on legacy RFQ explicitly stays identity-blocked for quote intake',()=>{
  const base=normalizeRfqRecord({productKey:'legacy-key',productName:'Display title',supplierName:'Supplier A',platform:'Alibaba'});
  const sent=markRfqSent(base,{confirmedRealDispatch:true,sentBy:'operator',channel:'Alibaba',sentAt:'2026-08-26T10:00:00Z'});
  const replied=markRfqReplied(sent.record,{confirmedRealResponse:true,responseReference:'msg-1',responseReceivedAt:'2026-08-26T12:00:00Z'});
  assert.match(followUpStatus(replied.record,'2026-08-26T13:00:00Z').nextAction,/identity-blocked/);
});

test('seed inherits canonicalProductId from RFQ queue when present',()=>{
  const rows=seedRfqRecords({canonicalProductId:ID,productCanonicalKey:'legacy-key',productTitle:'Title',entries:[{supplierName:'Supplier A',platform:'Alibaba',priority:1}]},{candidates:[{supplierName:'Supplier A',sourceUrl:'https://example.com'}]});
  assert.equal(rows.length,1);
  assert.equal(rows[0].canonicalProductId,ID);
  assert.equal(rows[0].decisionHandoffEligible,true);
});
