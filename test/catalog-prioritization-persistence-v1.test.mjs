import test from 'node:test';
import assert from 'node:assert/strict';
import {persistenceBundleToCandidates,prioritizePersistenceBundle} from '../catalog-prioritization-persistence-v1.js';

const bundle={
  schema:'MPR_CATALOG_PERSISTENCE_BUNDLE_V1',
  bundleSha256:'bundle-1',
  products:[{canonical_key:'GTIN:00012345678905',title:'Product One',brand:'Brand',category:'Home',canonical_name:'Product One',canonical_category:'Home'}],
  identities:[{canonical_key:'GTIN:00012345678905',namespace:'GTIN',value_norm:'00012345678905',source_key:'OPEN_FOOD_FACTS'}],
  sourceRecords:[{canonical_key:'GTIN:00012345678905',source_key:'OPEN_FOOD_FACTS',source_record_id:'12345678905',observed_at:'2026-08-29T00:00:00Z',record_fingerprint:'fp-1'}],
  claims:[],run:{source_key:'OPEN_FOOD_FACTS',retrieved_at:'2026-08-29T00:00:00Z'},
  counts:{products:1,identities:1,sourceRecords:1,claims:0},
  policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0},
  writeAuthorized:false
};

test('persistence bundle reconstructs strong candidate',()=>{
  const rows=persistenceBundleToCandidates(bundle);
  assert.equal(rows.length,1);
  assert.equal(rows[0].identityKeys[0].namespace,'GTIN');
  assert.equal(rows[0].sourceKey,'OPEN_FOOD_FACTS');
});

test('persistence prioritization emits bounded truth-safe selection',()=>{
  const out=prioritizePersistenceBundle(bundle,{topN:5000});
  assert.equal(out.schema,'MPR_PERSISTENCE_PRIORITIZATION_V1');
  assert.equal(out.evidenceClass,'CATALOG_PRIORITIZATION_ONLY');
  assert.equal(out.selectedCount,1);
  assert.equal(out.policy.providerDataSpendEur,0);
  assert.equal(out.policy.paidDataCallsTriggered,0);
  assert.equal(out.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.policy.verifiedSalesRows,0);
  assert.equal(out.policy.purchaseAuthorized,false);
  assert.equal(out.writeAuthorized,false);
});

test('relaxed source truth policy fails closed',()=>{
  assert.throws(()=>persistenceBundleToCandidates({...bundle,policy:{...bundle.policy,verifiedSalesRows:1}}),/SALES_TRUTH_POLICY_INVALID/);
});
