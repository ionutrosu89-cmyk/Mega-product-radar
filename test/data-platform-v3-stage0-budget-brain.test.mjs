import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('supabase/migrations/20260823_stage0_budget_brain_candidate_view.sql','utf8');

test('Stage 0 paid enrichment is restricted to advanced candidates',()=>{
  assert.match(sql,/p\.status in \('PROMISING','VALIDATE'\)/);
  assert.doesNotMatch(sql,/p\.status in \([^\n]*DISCOVERED/);
});

test('Budget Brain prefers cache and marks recent Romania data',()=>{
  assert.match(sql,/observed_at >= now\(\)-interval '30 days'/);
  assert.match(sql,/RECENT_RO_DATA/);
  assert.match(sql,/NEEDS_RO_KEYWORD_ENRICHMENT/);
});

test('conservative per-product estimate stays tiny in Stage 0',()=>{
  assert.match(sql,/0\.05::numeric\(10,4\)/);
  assert.match(sql,/revoke all on public\.v_stage0_paid_enrichment_candidates from anon, authenticated/);
});
