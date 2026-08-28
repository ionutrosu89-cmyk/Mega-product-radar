import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../supabase/migrations/20260828_catalog_bootstrap_status.sql',import.meta.url),'utf8');
const legacy=['DISCOVERED','PROMISING','VALIDATE','FINALIST','TEST_READY','BUY_READY','ARCHIVED'];

test('catalog bootstrap migration preserves legacy statuses and adds analysis-only catalogue status',()=>{
  for(const status of legacy)assert.match(migration,new RegExp(`'${status}'::text`));
  assert.match(migration,/'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'::text/);
  assert.match(migration,/drop constraint if exists canonical_products_status_check/i);
  assert.match(migration,/add constraint canonical_products_status_check/i);
});

test('analysis-only status remains explicitly non-commercial in migration documentation',()=>{
  assert.match(migration,/does not imply ranking, commercial use, verified sales, or purchase authorization/i);
});
