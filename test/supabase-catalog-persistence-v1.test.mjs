import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSupabaseCatalogPersistenceBatch,validateSupabaseCatalogPersistenceBatch,persistSupabaseCatalogBatch} from '../supabase-catalog-persistence-v1.js';

function fixture(){
  return {
    products:[{canonicalKey:'GTIN:00000000000001',title:'Fixture product',brand:'Fixture',category:'Test'}],
    identities:[{canonicalKey:'GTIN:00000000000001',namespace:'GTIN',valueNorm:'00000000000001',confidence:1,sourceKey:'OPEN_FOOD_FACTS'}],
    sourceRecords:[{canonicalKey:'GTIN:00000000000001',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'00000000000001',observedAt:'2026-08-27T00:00:00Z',rightsDecision:'ANALYSIS_ALLOWED',identityStrength:'STRONG_GTIN',rawPayload:{code:'00000000000001'}}],
    claims:[{canonicalKey:'GTIN:00000000000001',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'00000000000001',fieldName:'brand',fieldValue:'Fixture',observedAt:'2026-08-27T00:00:00Z',rightsDecision:'ANALYSIS_ALLOWED',confidence:1}],
    ingestionRun:{sourceKey:'OPEN_FOOD_FACTS',manifestSha256:'a'.repeat(64),recordsSha256:'b'.repeat(64),retrievedAt:'2026-08-27T00:00:00Z',inputCount:1,acceptedCount:1,heldCount:0,logicalDuplicateCount:0,silentDropCount:0,checkpointSha256:'c'.repeat(64),decision:'INGESTION_ACCOUNTED'}
  };
}

test('persistence batch is bounded deterministic and preserves truth policy',()=>{
  const a=buildSupabaseCatalogPersistenceBatch(fixture(),{maxProducts:100});
  const b=buildSupabaseCatalogPersistenceBatch(fixture(),{maxProducts:100});
  assert.deepEqual(a,b);
  assert.equal(a.products.length,1);
  assert.equal(a.policy.providerDataSpendEur,0);
  assert.equal(a.policy.paidDataCallsTriggered,0);
  assert.equal(a.policy.purchaseAuthorized,false);
  assert.equal(a.policy.verifiedSalesRows,0);
  assert.equal(a.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(validateSupabaseCatalogPersistenceBatch(a).valid,true);
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
  assert.match(rpc,/revoke all on function public\.mpr_persist_catalog_batch_v1\(uuid,jsonb\) from public, anon, authenticated/);
  assert.match(rpc,/grant execute on function public\.mpr_persist_catalog_batch_v1\(uuid,jsonb\) to service_role/);
  assert.match(rpc,/CATALOG_POLICY_INVARIANT_FAILED/);
});
