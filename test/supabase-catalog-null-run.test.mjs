import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSupabaseCatalogPersistenceBatch,validateSupabaseCatalogPersistenceBatch} from '../supabase-catalog-persistence-v1.js';

test('batch builder omits ingestionRun when source bundle has no run',()=>{
  const batch=buildSupabaseCatalogPersistenceBatch({
    products:[{canonical_key:'GTIN:00000000000017',title:'Canary'}],
    identities:[{canonical_key:'GTIN:00000000000017',namespace:'GTIN',value_norm:'00000000000017',confidence:1,source_key:'OPEN_FOOD_FACTS'}],
    sourceRecords:[],
    claims:[]
  },{maxProducts:1});
  assert.equal(Object.hasOwn(batch,'ingestionRun'),false);
  assert.equal(validateSupabaseCatalogPersistenceBatch(batch).valid,true);
});

test('RPC hardening migration treats JSON null ingestionRun as absent',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20260828_catalog_persistence_null_run.sql',import.meta.url),'utf8');
  assert.match(sql,/jsonb_typeof\(v_run\) <> 'null'/i);
  assert.match(sql,/CATALOG_POLICY_INVARIANT_FAILED/);
  assert.match(sql,/NOT_VERIFIED_SALES/);
});
