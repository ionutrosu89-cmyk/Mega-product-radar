import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedWriteConfirmation,validateControlledWriteRequest,executeControlledOffWrite} from '../off-controlled-production-writer-v1.js';

function bundle(n=10){
  const products=[];const identities=[];const sourceRecords=[];const claims=[];
  for(let i=0;i<n;i++){
    const gtin=String(i+1).padStart(14,'0');const key=`GTIN:${gtin}`;
    products.push({canonical_key:key,title:`P${i}`});
    identities.push({canonical_key:key,namespace:'GTIN',value_norm:gtin,confidence:1,source_key:'OPEN_FOOD_FACTS'});
    sourceRecords.push({canonical_key:key,source_key:'OPEN_FOOD_FACTS',source_record_id:String(i),rights_decision:'ACCEPT',payload:{code:gtin}});
    claims.push({canonical_key:key,sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:String(i),field:'title',value:`P${i}`,rightsDecision:'ACCEPT',claimSha256:`c${i}`});
  }
  return{bundleSha256:'abc123',products,identities,sourceRecords,claims};
}

test('write request is hash-bound and exact-target bound',()=>{
  const b=bundle();
  const out=validateControlledWriteRequest(b,{targetProducts:10,batchSize:5,expectedBundleSha256:'abc123',writeEnabled:false});
  assert.equal(out.valid,true);
  assert.equal(out.plan.batchCount,2);
  assert.equal(out.plan.selectedProducts,10);
});

test('enabled write requires exact confirmation token',()=>{
  const b=bundle();
  const bad=validateControlledWriteRequest(b,{targetProducts:10,expectedBundleSha256:'abc123',writeEnabled:true,confirmation:'wrong'});
  assert.equal(bad.valid,false);
  assert.ok(bad.reasons.includes('EXPLICIT_WRITE_CONFIRMATION_REQUIRED'));
  const token=expectedWriteConfirmation({bundleSha256:'abc123',targetProducts:10});
  const good=validateControlledWriteRequest(b,{targetProducts:10,expectedBundleSha256:'abc123',writeEnabled:true,confirmation:token});
  assert.equal(good.valid,true);
});

test('disabled execution performs no production write',async()=>{
  const b=bundle();
  const out=await executeControlledOffWrite(b,{targetProducts:10,batchSize:5,expectedBundleSha256:'abc123',writeEnabled:false});
  assert.equal(out.productionWritePerformed,false);
  assert.equal(out.completedBatchCount,2);
  assert.ok(out.receipts.every(x=>x.receipt.productionWritePerformed===false));
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
