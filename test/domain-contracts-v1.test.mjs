import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalProduct,createProductAlias,createEvidence,assertSameCanonicalProduct,assertNoSilentEvidenceUpgrade,createOpportunityDecision,DOMAIN_POLICY} from '../domain-contracts-v1.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('canonical identity survives title changes and aliases bind by external id',()=>{
  const p1=createCanonicalProduct({canonicalProductId:A,title:'Old title'});
  const p2=createCanonicalProduct({canonicalProductId:A,title:'New title'});
  assert.equal(p1.canonicalProductId,p2.canonicalProductId);
  const alias=createProductAlias({canonicalProductId:A,platform:'amazon_us',externalId:'B00TEST123',observedTitle:'New title'});
  assert.equal(alias.canonicalProductId,A);
  assert.equal(alias.platform,'AMAZON_US');
  assert.equal(alias.externalId,'B00TEST123');
});

test('same title on different canonical ids never merges identity',()=>{
  const a=createCanonicalProduct({canonicalProductId:A,title:'Same title'});
  const b=createCanonicalProduct({canonicalProductId:B,title:'Same title'});
  assert.notEqual(a.canonicalProductId,b.canonicalProductId);
  assert.match(DOMAIN_POLICY.identity,/PRODUCT_NAME_IS_LABEL_ONLY/);
  assert.match(DOMAIN_POLICY.identity,/NEVER_AUTO_MERGES/);
});

test('evidence requires provenance and preserves missing value as null',()=>{
  assert.throws(()=>createEvidence({canonicalProductId:A,value:12,observedAt:'2026-08-26T10:00:00Z'}),/EVIDENCE_PROVENANCE_REQUIRED/);
  const e=createEvidence({canonicalProductId:A,value:null,observedAt:'2026-08-26T10:00:00Z',source:'Amazon public page',evidenceClass:'DIRECT_OBSERVED'});
  assert.equal(e.value,null);
  assert.equal(e.evidenceClass,'DIRECT_OBSERVED');
});

test('decision-critical evidence from another product is rejected',()=>{
  const supplier=createEvidence({canonicalProductId:B,value:{supplier:'X'},observedAt:'2026-08-26T10:00:00Z',source:'Manual dossier',evidenceClass:'MANUALLY_VERIFIED'});
  assert.throws(()=>assertSameCanonicalProduct(A,supplier),/CROSS_PRODUCT_EVIDENCE_REJECTED/);
  assert.throws(()=>createOpportunityDecision({canonicalProductId:A,stage:'FINALIST',evidence:[supplier]}),/CROSS_PRODUCT_EVIDENCE_REJECTED/);
});

test('evidence class cannot be silently upgraded',()=>{
  assert.throws(()=>assertNoSilentEvidenceUpgrade('ESTIMATED','VERIFIED'),/SILENT_EVIDENCE_UPGRADE_REJECTED/);
  assert.equal(assertNoSilentEvidenceUpgrade('ESTIMATED','VERIFIED',{explicitReview:true}),true);
  assert.equal(assertNoSilentEvidenceUpgrade('VERIFIED','DERIVED'),true);
});

test('canonical opportunity decision never contains purchase authority',()=>{
  const e=createEvidence({canonicalProductId:A,value:1,observedAt:'2026-08-26T10:00:00Z',source:'Test',evidenceClass:'DIRECT_OBSERVED'});
  const d=createOpportunityDecision({canonicalProductId:A,stage:'VALIDATE',reasonCodes:['TREND_CONFIRMED'],evidence:[e]});
  assert.equal(d.stage,'VALIDATE');
  assert.equal(d.purchaseAuthorized,false);
  assert.equal(d.automaticPurchaseAllowed,false);
  assert.throws(()=>createOpportunityDecision({canonicalProductId:A,stage:'BUY_READY',evidence:[e],purchaseAuthorized:true}),/PURCHASE_AUTHORITY_FORBIDDEN/);
});
