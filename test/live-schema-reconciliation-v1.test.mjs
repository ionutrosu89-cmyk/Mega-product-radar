import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('precanonical compatibility migration runs before canonical identity migration',()=>{
  const names=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(x=>x.startsWith('20260826_')).sort();
  const pre=names.indexOf('20260826_00_precanonical_schema_compatibility_v1.sql');
  const canonical=names.indexOf('20260826_canonical_product_identity_v1.sql');
  assert.ok(pre>=0);assert.ok(canonical>=0);assert.ok(pre<canonical);
});

test('canonical compatibility preserves legacy product and alias bindings',()=>{
  const sql=read('supabase/migrations/20260826_00_precanonical_schema_compatibility_v1.sql');
  assert.match(sql,/canonical_product_id = coalesce\(canonical_product_id, product_id\)/);
  assert.match(sql,/match_method = coalesce\(match_method, 'MIGRATED_LEGACY'\)/);
  assert.match(sql,/product_aliases_platform_external_id_uidx/);
});

test('global supplier entity namespace cannot overwrite workspace suppliers',()=>{
  const sql=read('supabase/migrations/20260826_supplier_entity_namespace_reconciliation_v1.sql');
  assert.match(sql,/supplier_entities_v3/);
  assert.match(sql,/SUPPLIER_QUOTES_NOT_EMPTY_MANUAL_MIGRATION_REQUIRED/);
  assert.doesNotMatch(sql,/drop table\s+public\.suppliers/i);
});

test('canonical bootstrap resolver is service-role only and exact alias driven',()=>{
  const sql=read('supabase/migrations/20260826_canonical_bootstrap_rpc_v1.sql');
  assert.match(sql,/where pa\.platform = v_platform and pa\.external_id = v_external_id/);
  assert.match(sql,/revoke execute .* (?:public,)?anon,authenticated/);
  assert.match(sql,/grant execute .* service_role/);
  assert.doesNotMatch(sql,/where .*title.*=/i);
});

test('bootstrap importer is dry-run by default and requires explicit approval for writes',()=>{
  const src=read('scripts/import-canonical-bootstrap-to-supabase.mjs');
  assert.match(src,/const execute=args\.has\('--execute'\)/);
  assert.match(src,/MPR_CANONICAL_BOOTSTRAP_IMPORT_APPROVED/);
  assert.match(src,/if\(!execute\)/);
  assert.match(src,/purchaseAuthorized:false/);
});
