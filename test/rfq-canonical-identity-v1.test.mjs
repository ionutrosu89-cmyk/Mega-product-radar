import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeRfqRecord,followUpStatus} from '../rfq-dispatch-state.js';

const id='123e4567-e89b-42d3-a456-426614174000';

test('RFQ record preserves canonical product identity when explicitly supplied',()=>{
  const r=normalizeRfqRecord({canonicalProductId:id,productKey:'legacy-key',productName:'Product',supplierName:'Supplier',platform:'Alibaba'});
  assert.equal(r.canonicalProductId,id);
  assert.equal(r.identityStatus,'CANONICAL');
  assert.equal(r.decisionHandoffEligible,true);
});

test('legacy RFQ remains operationally trackable but decision handoff is blocked',()=>{
  const r=normalizeRfqRecord({productKey:'legacy-key',productName:'Product',supplierName:'Supplier',platform:'Alibaba',status:'SENT',sentAt:'2026-08-25T10:00:00Z',sentBy:'operator',channel:'Alibaba'});
  assert.equal(r.canonicalProductId,null);
  assert.equal(r.decisionHandoffEligible,false);
  const replied={...r,status:'REPLIED',responseReceivedAt:'2026-08-25T12:00:00Z',responseReference:'msg-1'};
  assert.match(followUpStatus(replied,'2026-08-25T13:00:00Z').nextAction,/identity-blocked/);
});

test('Sourcing Ops forwards canonicalProductId to Quote Intake and never infers it from title',async()=>{
  const js=await fs.readFile(new URL('../sourcing-ops.js',import.meta.url),'utf8');
  assert.match(js,/params\.canonicalProductId/);
  assert.match(js,/isCanonicalProductId\(r\.canonicalProductId\)/);
  assert.match(js,/Quote\/Supplier Gate fail-closed/);
  assert.doesNotMatch(js,/canonicalProductId\s*=\s*keyOf\(/);
});
