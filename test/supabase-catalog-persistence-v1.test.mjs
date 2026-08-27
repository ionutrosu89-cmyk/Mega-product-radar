import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSupabaseCatalogPersistenceBatch,validateSupabaseCatalogPersistenceBatch,persistSupabaseCatalogBatch} from '../supabase-catalog-persistence-v1.js';

function fixture(){
  return {
    products:[{canonical_key:'GTIN:00000000000001',title:'Fixture product',brand:'Fixture',category:'Test'}],
    identities:[{canonical_key:'GTIN:00000000000001',namespace:'GTIN',value_norm:'00000000000001',confidence:1,source_key:'OPEN_FOOD_FACTS'}],
    sourceRecords:[{canonical_key:'GTIN:00000000000001',source_key:'OPEN_FOOD_FACTS',source_record_id:'00000000000001',observed_at:'2026-08-27T00:00:00Z',rights_decision:'ACCEPT',identity_strength:'STRONG_GTIN',payload:{code:'00000000000001'}}],
    claims:[{canonical_key:'GTIN:00000000000001',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'00000000000001',field:'brand',value:'Fixture',observedAt:'2026-08-27T00:00:00Z',rightsDecision:'ACCEPT',confidence:1,claimSha256:'d'.repeat(64)}],
    run:{source_key:'OPEN_FOOD_FACTS',manifest_sha256:'a'.repeat(64),records_sha256:'b'.repeat(64),retrieved_at:'2026-08-27T00:00:00Z',input_count:1,accepted_count:1,held_count:0,logical_duplicate_count:0,silent_drop_count:0,checkpoint_sha256:'c'.repeat(64),decision:'INGESTION_ACCOUNTED'}
  };
}

test('actual OFF persistence shape becomes bounded deterministic batch',()=>{
  const a=buildSupabaseCatalogPersistenceBatch(fixture(),{maxProducts:100});
  const b=buildSupabaseCatalogPersistenceBatch(fixture(),{maxProducts:100});
  assert.deepEqual(a,b);
  assert.equal(a.products.length,1);
  assert.equal(a.identities.length,1);
  assert.equal(a.sourceRecords.length,1);
  assert.equal(a.claims.length,1);
  assert.equal(a.products[0].status,'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY');
  assert.equal(a.identities[0].valueNorm,'00000000000001');
  assert.equal(a.sourceRecords[0].rawPayload.code,'00000000000001');
  assert.equal(a.claims[0].fieldName,'brand');
  assert.equal(a.ingestionRun.sourceKey,'OPEN_FOOD_FACTS');
  assert.equal(a.policy.providerDataSpendEur,0);
  assert.equal(a.policy.paidDataCallsTriggered,0);
  assert.equal(a.policy.purchaseAuthorized,false);
  assert.equal(a.policy.verifiedSalesRows,0);
  assert.equal(a.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(validateSupabaseCatalogPersistenceBatch(a).valid,true);
});

test('bounded batch cannot retain relations for products outside the slice',()=>{
  const f=fixture();
  f.products.push({canonical_key:'GTIN:00000000000002',title:'Second'});
  f.identities.push({canonical_key:'GTIN:00000000000002',namespace:'GTIN',value_norm:'00000000000002'});
  f.sourceRecords.push({canonical_key:'GTIN:00000000000002',source_key:'OPEN_FOOD_FACTS',source_record_id:'2',payload:{}});
  f.claims.push({canonical_key:'GTIN:00000000000002',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'2',field:'title',value:'Second'});
  const batch=buildSupabaseCatalogPersistenceBatch(f,{maxProducts:1});
  assert.equal(batch.products.length,1);
  assert.equal(batch.identities.length,1);
  assert.equal(batch.sourceRecords.length,1);
  assert.equal(batch.claims.length,1);
  assert.equal(validateSupabaseCatalogPersistenceBatch(batch).valid,true);
});

test('tampering or paid/purchase claims fail closed',()=>{
  const batch=buildSupabaseCatalogPersistenceBatch(fixture());
  batch.policy.purchaseAuthorized=true;
  const result=validateSupabaseCatalogPersistenceBatch(batch);
  assert.equal(result.valid,false);
  assert.ok(result.reasons.includes('PURCHASE_AUTHORIZATION_FORBIDDEN'));
  assert.ok(result.reasons.includes('BATCH_HASH_MISMATCH'));
});

test('remote write is disabled by default',async()=>{
  const batch=buildSupabaseCatalogPersistenceBatch(fixture());
  const receipt=await persistSupabaseCatalogBatch(batch,{enabled:false});
  assert.equal(receipt.writeEnabled,false);
  assert.equal(receipt.productionWritePerformed,false);
  assert.equal(receipt.policy.purchaseAuthorized,false);
});

test('enabled client calls only transactional rpc',async()=>{
  const batch=buildSupabaseCatalogPersistenceBatch(fixture());
  let called=null;
  const receipt=await persistSupabaseCatalogBatch(batch,{
    enabled:true,
    supabaseUrl:'https://example.supabase.co',
    serviceRoleKey:'server-only-test-key',
    workspaceId:'00000000-0000-0000-0000-000000000001',
    fetchImpl:async(url,init)=>{
      called={url,init};
      return {ok:true,json:async()=>({schema:'MPR_SUPABASE_CATALOG_PERSISTENCE_RECEIPT_V1'}),text:async()=>''};
    }
  });
  assert.match(called.url,/\/rest\/v1\/rpc\/mpr_persist_catalog_batch_v1$/);
  assert.equal(JSON.parse(called.init.body).p_batch.policy.purchaseAuthorized,false);
  assert.equal(receipt.productionWritePerformed,true);
});

test('catalog FK migration targets canonical_products and RPC is service-role only',()=>{
  const fk=readFileSync(new URL('../supabase/migrations/20260827_catalog_canonical_fk_v2.sql',import.meta.url),'utf8');
  const rpc=readFileSync(new URL('../supabase/migrations/20260827_catalog_persistence_rpc_v1.sql',import.meta.url),'utf8');
  assert.match(fk,/references public\.canonical_products\(id\)/);
  assert.doesNotMatch(fk,/references public\.products\(id\)/);
  assert.match(rpc,/CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY/);
  assert.match(rpc,/PRODUCT_STATUS_INVARIANT_FAILED/);
  assert.match(rpc,/revoke all on function public\.mpr_persist_catalog_batch_v1\(uuid,jsonb\) from public, anon, authenticated/);
  assert.match(rpc,/grant execute on function public\.mpr_persist_catalog_batch_v1\(uuid,jsonb\) to service_role/);
  assert.match(rpc,/CATALOG_POLICY_INVARIANT_FAILED/);
});
