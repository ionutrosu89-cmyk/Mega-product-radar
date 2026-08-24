import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('supabase/migrations/20260824_supplier_evidence_database_v4.sql','utf8');

test('supplier evidence database stores reusable quote facts',()=>{
  for(const field of [
    'ddp_total','ddp_includes_vat','ddp_includes_duty','ddp_includes_clearance',
    'importer_of_record','mrn_promised','vat_proof_promised','trade_assurance',
    'pre_shipment_inspection','gross_weight_kg','product_material','quote_valid_until',
    'compliance_status','evidence_status','raw_evidence_ref'
  ]) assert.match(sql,new RegExp(field));
});

test('supplier evidence is append-only evidence, not a purchase shortcut',()=>{
  assert.match(sql,/create table if not exists public\.supplier_quote_evidence/i);
  assert.match(sql,/SUPPLIER_STATED/);
  assert.match(sql,/MANUALLY_VERIFIED/);
  assert.match(sql,/Evidence storage never implies TEST_READY or BUY_READY/i);
  assert.doesNotMatch(sql,/update\s+public\.canonical_products\s+set\s+status\s*=\s*'BUY_READY'/i);
});

test('comparison derives DDP per unit only from explicit total and quantity',()=>{
  assert.match(sql,/case when q\.quantity > 0 and q\.ddp_total is not null then q\.ddp_total \/ q\.quantity end as ddp_per_unit/i);
  assert.match(sql,/with \(security_invoker = true\)/i);
  assert.match(sql,/revoke all on public\.supplier_quote_comparison_v4 from anon, authenticated/i);
});
