import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalProductKey,normalizeObservation,buildCanonicalBatch,deterministicFingerprint,evaluateScaleGate} from '../data-pipeline-core-v1.js';

test('canonical key is stable across casing and whitespace',()=>{
  assert.equal(canonicalProductKey({platform:' amazon ',marketplace:'amazon.com',externalId:' b00inkvs82 '}),'AMAZON:AMAZON.COM:B00INKVS82');
});

test('normalization preserves truth defaults and canonical identity',()=>{
  const row=normalizeObservation({platform:'amazon',externalId:'B00INKVS82',title:' Product  ',sourceKey:'seed'});
  assert.equal(row.canonicalKey,'AMAZON:AMAZON:B00INKVS82');
  assert.equal(row.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(row.purchaseAuthorized,false);
  assert.equal(row.title,'Product');
});

test('canonical batch rejects logical duplicates instead of inflating product count',()=>{
  const batch=buildCanonicalBatch([
    {platform:'AMAZON',marketplace:'US',externalId:'B00INKVS82',title:'A'},
    {platform:'amazon',marketplace:'us',externalId:'b00inkvs82',title:'A duplicate'},
    {platform:'AMAZON',marketplace:'US',externalId:'B000000001',title:'B'}
  ]);
  assert.equal(batch.manifest.inputCount,3);
  assert.equal(batch.manifest.canonicalCount,2);
  assert.equal(batch.manifest.logicalDuplicateCount,1);
  assert.equal(batch.rejected[0].errors[0],'LOGICAL_DUPLICATE');
});

test('truth and purchase violations are rejected at normalization boundary',()=>{
  const batch=buildCanonicalBatch([
    {platform:'AMAZON',externalId:'B000000001',salesEvidenceClass:'VERIFIED_SALES'},
    {platform:'AMAZON',externalId:'B000000002',purchaseAuthorized:true}
  ]);
  assert.equal(batch.manifest.canonicalCount,0);
  assert.equal(batch.manifest.rejectedCount,2);
  assert.ok(batch.rejected.some(x=>x.errors.includes('VERIFIED_SALES_REQUIRES_TRUTH_PIPELINE')));
  assert.ok(batch.rejected.some(x=>x.errors.includes('PURCHASE_AUTHORIZATION_FORBIDDEN')));
});

test('fingerprint is deterministic for semantically identical object ordering',()=>{
  assert.equal(deterministicFingerprint({b:2,a:{y:2,x:1}}),deterministicFingerprint({a:{x:1,y:2},b:2}));
});

test('scale gate remains HOLD below one million canonical products',()=>{
  const batch=buildCanonicalBatch([{platform:'AMAZON',externalId:'B000000001'}]);
  const gate=evaluateScaleGate(batch,{provenanceComplete:true,restoreVerified:true,replayDeterministic:true,queuesStable:true,p95Ms:100});
  assert.equal(gate.decision,'HOLD_SCALE');
  assert.equal(gate.scaleAuthorized,false);
  assert.ok(gate.failed.includes('canonicalVolume'));
});

test('scale gate requires all operational checks, not volume alone',()=>{
  const fake={manifest:{canonicalCount:1000000,logicalDuplicateCount:0}};
  const gate=evaluateScaleGate(fake,{provenanceComplete:true,restoreVerified:false,replayDeterministic:true,queuesStable:true,p95Ms:100});
  assert.equal(gate.decision,'HOLD_SCALE');
  assert.ok(gate.failed.includes('restoreVerified'));
});

test('scale gate can become ready only when every invariant is satisfied',()=>{
  const fake={manifest:{canonicalCount:1000000,logicalDuplicateCount:0}};
  const gate=evaluateScaleGate(fake,{provenanceComplete:true,restoreVerified:true,replayDeterministic:true,queuesStable:true,p95Ms:250,p95LimitMs:1000});
  assert.equal(gate.decision,'SCALE_READY');
  assert.equal(gate.scaleAuthorized,true);
});
