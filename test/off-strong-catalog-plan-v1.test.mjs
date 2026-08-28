import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOffStrongCatalogPlan,validateOffStrongCatalogPlan} from '../off-strong-catalog-plan-v1.js';

function bundle(){
  const products=[];const identities=[];const sourceRecords=[];const claims=[];
  for(let i=0;i<12;i++){
    const key=`GTIN:${String(i+1).padStart(14,'0')}`;
    products.push({canonical_key:key,title:`P${i}`,brand:'B',category:'C'});
    identities.push({canonical_key:key,namespace:'GTIN',value_norm:String(i+1).padStart(14,'0'),confidence:1,source_key:'OPEN_FOOD_FACTS'});
    sourceRecords.push({canonical_key:key,source_key:'OPEN_FOOD_FACTS',source_record_id:String(i),observed_at:'2026-08-28T00:00:00Z',rights_decision:'ACCEPT',payload:{code:String(i)}});
    claims.push({canonical_key:key,sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:String(i),field:'title',value:`P${i}`,observedAt:'2026-08-28T00:00:00Z',rightsDecision:'ACCEPT',confidence:1,claimSha256:`c${i}`});
  }
  products.push({canonical_key:'FINGERPRINT:weak',title:'Weak'});
  return{bundleSha256:'source-sha',products,identities,sourceRecords,claims};
}

test('strong plan selects only GTIN canonical products with complete provenance',()=>{
  const plan=buildOffStrongCatalogPlan(bundle(),{batchSize:5,maxProducts:10});
  assert.equal(plan.selectedProducts,10);
  assert.equal(plan.selectedIdentities,10);
  assert.equal(plan.selectedSourceRecords,10);
  assert.equal(plan.batchCount,2);
  assert.equal(plan.productionWriteAuthorized,false);
  assert.equal(plan.purchaseAuthorized,false);
  assert.equal(plan.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(validateOffStrongCatalogPlan(plan,{minProducts:10}).valid,true);
  assert.ok(plan.batches.every(b=>b.products.every(p=>p.canonicalKey.startsWith('GTIN:'))));
});

test('plan fails closed below target',()=>{
  const plan=buildOffStrongCatalogPlan(bundle(),{batchSize:5,maxProducts:5});
  const validation=validateOffStrongCatalogPlan(plan,{minProducts:10});
  assert.equal(validation.valid,false);
  assert.ok(validation.reasons.includes('STRONG_PRODUCTS_BELOW_TARGET'));
});
