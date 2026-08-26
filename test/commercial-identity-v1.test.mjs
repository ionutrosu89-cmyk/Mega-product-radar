import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalCommercialKey,normalizeCommercialIdentity,attachCanonicalCommercialIdentity,readCommercialRecord,writeCanonicalCommercialRecord,commercialRecordCanSatisfyDecisionGate,COMMERCIAL_IDENTITY_POLICY} from '../commercial-identity-v1.js';

const ID='11111111-1111-4111-8111-111111111111';

test('canonical commercial key is stable and UUID based',()=>{
  assert.equal(canonicalCommercialKey(ID),'canonical:11111111-1111-4111-8111-111111111111');
});

test('product name alone is label-only and never decision eligible',()=>{
  const x=normalizeCommercialIdentity({productName:'Foldable Trunk Organizer'});
  assert.equal(x.canonicalProductId,null);
  assert.equal(x.identityStatus,'LEGACY_LABEL_ONLY');
  assert.equal(x.decisionEligible,false);
});

test('canonical identity preserves display label without using it as the key',()=>{
  const x=attachCanonicalCommercialIdentity({supplierName:'Factory A'},{canonicalProductId:ID,productName:'Display Name'});
  assert.equal(x.canonicalProductId,ID);
  assert.equal(x.productName,'Display Name');
  assert.equal(x.decisionEligible,true);
});

test('legacy name-key fallback remains readable but cannot satisfy a decision gate',()=>{
  const records={'foldable trunk organizer':{productName:'Foldable Trunk Organizer',commercialVerified:true}};
  const result=readCommercialRecord(records,{productName:'Foldable Trunk Organizer'});
  assert.equal(result.source,'LEGACY_LABEL_FALLBACK');
  assert.equal(result.decisionEligible,false);
  assert.equal(commercialRecordCanSatisfyDecisionGate(result.record),false);
});

test('canonical record wins over a conflicting legacy title record',()=>{
  const records={
    [canonicalCommercialKey(ID)]:{canonicalProductId:ID,productName:'New Title',decisionEligible:true,value:1},
    'new title':{productName:'New Title',decisionEligible:false,value:999}
  };
  const result=readCommercialRecord(records,{canonicalProductId:ID,productName:'New Title'});
  assert.equal(result.source,'CANONICAL');
  assert.equal(result.record.value,1);
  assert.equal(commercialRecordCanSatisfyDecisionGate(result.record),true);
});

test('decision-critical commercial write fails closed without canonical product id',()=>{
  assert.throws(()=>writeCanonicalCommercialRecord({}, {productName:'Same title'}, {commercialVerified:true}),e=>e?.code==='CANONICAL_PRODUCT_ID_REQUIRED_FOR_COMMERCIAL_WRITE');
});

test('canonical write cannot be hijacked by title collision',()=>{
  const other='22222222-2222-4222-8222-222222222222';
  let records={};
  records=writeCanonicalCommercialRecord(records,{canonicalProductId:ID,productName:'Same title'},{value:'A'});
  records=writeCanonicalCommercialRecord(records,{canonicalProductId:other,productName:'Same title'},{value:'B'});
  assert.equal(records[canonicalCommercialKey(ID)].value,'A');
  assert.equal(records[canonicalCommercialKey(other)].value,'B');
  assert.equal(Object.keys(records).length,2);
});

test('policy explicitly makes legacy product names non-authoritative',()=>{
  assert.match(COMMERCIAL_IDENTITY_POLICY.canonicalWrite,/REQUIRE_CANONICAL_PRODUCT_ID/);
  assert.match(COMMERCIAL_IDENTITY_POLICY.legacyRead,/NEVER_DECISION_ELIGIBLE/);
  assert.match(COMMERCIAL_IDENTITY_POLICY.title,/DISPLAY_LABEL_ONLY/);
});
