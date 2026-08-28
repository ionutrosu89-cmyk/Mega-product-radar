import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildStrongGtinPersistencePilot,validateStrongGtinPersistencePilot} from '../strong-gtin-persistence-pilot-v1.js';

function bundle(){
  return {
    products:[
      {canonical_key:'GTIN:04006381333931',title:'Valid A'},
      {canonical_key:'GTIN:05901234123457',title:'Valid B'},
      {canonical_key:'GTIN:04006381333932',title:'Invalid checksum'},
      {canonical_key:'FALLBACK:ACME:X',title:'Fallback'}
    ],
    identities:[
      {canonical_key:'GTIN:04006381333931',namespace:'GTIN',value_norm:'04006381333931',confidence:1,source_key:'OPEN_FOOD_FACTS'},
      {canonical_key:'GTIN:05901234123457',namespace:'GTIN',value_norm:'05901234123457',confidence:1,source_key:'OPEN_FOOD_FACTS'},
      {canonical_key:'GTIN:04006381333932',namespace:'GTIN',value_norm:'04006381333932',confidence:1,source_key:'OPEN_FOOD_FACTS'},
      {canonical_key:'FALLBACK:ACME:X',namespace:'BRAND_MPN',value_norm:'ACME:X',confidence:0.9,source_key:'OPEN_FOOD_FACTS'}
    ],
    sourceRecords:[
      {canonical_key:'GTIN:04006381333931',source_key:'OPEN_FOOD_FACTS',source_record_id:'4006381333931',observed_at:'2026-08-28T00:00:00Z',rights_decision:'ACCEPT',identity_strength:'STRONG_GTIN',payload:{}},
      {canonical_key:'GTIN:05901234123457',source_key:'OPEN_FOOD_FACTS',source_record_id:'5901234123457',observed_at:'2026-08-28T00:00:00Z',rights_decision:'ACCEPT',identity_strength:'STRONG_GTIN',payload:{}},
      {canonical_key:'GTIN:04006381333932',source_key:'OPEN_FOOD_FACTS',source_record_id:'4006381333932',observed_at:'2026-08-28T00:00:00Z',rights_decision:'ACCEPT',identity_strength:'STRONG_GTIN',payload:{}},
      {canonical_key:'FALLBACK:ACME:X',source_key:'OPEN_FOOD_FACTS',source_record_id:'fallback',observed_at:'2026-08-28T00:00:00Z',rights_decision:'ACCEPT',identity_strength:'FALLBACK',payload:{}}
    ],
    claims:[
      {canonical_key:'GTIN:04006381333931',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'4006381333931',field:'title',value:'Valid A',observedAt:'2026-08-28T00:00:00Z',rightsDecision:'ACCEPT'},
      {canonical_key:'GTIN:05901234123457',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'5901234123457',field:'title',value:'Valid B',observedAt:'2026-08-28T00:00:00Z',rightsDecision:'ACCEPT'}
    ],
    run:{source_key:'OPEN_FOOD_FACTS',manifest_sha256:'a'.repeat(64),records_sha256:'b'.repeat(64),retrieved_at:'2026-08-28T00:00:00Z',input_count:4,accepted_count:4,held_count:0,logical_duplicate_count:0,silent_drop_count:0,checkpoint_sha256:'c'.repeat(64),decision:'INGESTION_ACCOUNTED'}
  };
}

test('pilot keeps only checksum-valid strong GTIN products',()=>{
  const batch=buildStrongGtinPersistencePilot(bundle(),{maxProducts:100});
  assert.deepEqual(batch.products.map(x=>x.canonicalKey),['GTIN:04006381333931','GTIN:05901234123457']);
  assert.equal(batch.identities.length,2);
  assert.ok(batch.identities.every(x=>x.namespace==='GTIN'));
  assert.ok(batch.sourceRecords.every(x=>x.rightsDecision==='ACCEPT'));
  assert.ok(batch.sourceRecords.every(x=>x.identityStrength==='STRONG_GTIN'));
  assert.equal(validateStrongGtinPersistencePilot(batch).valid,true);
});

test('fallback-only and invalid-checksum input cannot form persistence pilot',()=>{
  const f=bundle();
  f.products=f.products.slice(2);
  f.identities=f.identities.slice(2);
  f.sourceRecords=f.sourceRecords.slice(2);
  f.claims=[];
  assert.throws(()=>buildStrongGtinPersistencePilot(f),/STRONG_GTIN_PRODUCTS_REQUIRED/);
});

test('tampered invalid GTIN checksum fails validation',()=>{
  const batch=buildStrongGtinPersistencePilot(bundle(),{maxProducts:1});
  batch.identities[0].valueNorm='04006381333932';
  const result=validateStrongGtinPersistencePilot(batch);
  assert.equal(result.valid,false);
  assert.ok(result.reasons.includes('INVALID_GTIN_CHECKSUM'));
});

test('rights and identity strength fail closed when tampered',()=>{
  const batch=buildStrongGtinPersistencePilot(bundle(),{maxProducts:1});
  batch.sourceRecords[0].rightsDecision='HOLD';
  batch.sourceRecords[0].identityStrength='FALLBACK';
  const result=validateStrongGtinPersistencePilot(batch);
  assert.equal(result.valid,false);
  assert.ok(result.reasons.includes('SOURCE_RIGHTS_NOT_ACCEPTED'));
  assert.ok(result.reasons.includes('SOURCE_IDENTITY_NOT_STRONG_GTIN'));
});

test('pilot is bounded to maximum requested products',()=>{
  const batch=buildStrongGtinPersistencePilot(bundle(),{maxProducts:1});
  assert.equal(batch.products.length,1);
  assert.equal(batch.identities.length,1);
  assert.throws(()=>buildStrongGtinPersistencePilot(bundle(),{maxProducts:1001}),/INVALID_MAX_PRODUCTS/);
});

test('database migration forbids canonical identity rebinding',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20260828_catalog_identity_rebind_guard_v1.sql',import.meta.url),'utf8');
  assert.match(sql,/CATALOG_IDENTITY_REBIND_FORBIDDEN/);
  assert.match(sql,/before update of product_id on public\.product_identity_keys_v2/i);
  assert.match(sql,/old\.product_id is distinct from new\.product_id/i);
  assert.match(sql,/revoke all on function public\.mpr_guard_catalog_identity_rebind_v1\(\) from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.mpr_guard_catalog_identity_rebind_v1\(\) to service_role/i);
});
