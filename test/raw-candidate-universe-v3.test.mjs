import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Raw Candidate Universe remains server-only and cannot auto-promote',async()=>{
  const sql=await fs.readFile('supabase/migrations/20260823_raw_candidate_universe_v3.sql','utf8');
  assert.match(sql,/raw_product_candidates/);
  assert.match(sql,/default 'RAW'/);
  assert.match(sql,/RAW','SHORTLISTED','PROMOTED','REJECTED/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.raw_product_candidates from anon, authenticated/);
  assert.match(sql,/grant select,insert,update,delete on public\.raw_product_candidates to service_role/);
});

test('Stage 0 post-scan sync keeps raw universe separate from canonical Stage 0',async()=>{
  const script=await fs.readFile('scripts/stage0-supabase-sync.mjs','utf8');
  assert.match(script,/RAW_CANDIDATE_BATCH_CAP=500/);
  assert.match(script,/STAGE0_PRODUCT_CAP=100/);
  assert.match(script,/rawCandidates/);
  assert.match(script,/discovery-live\.json/);
  assert.match(script,/rawCandidates\.length>=RAW_CANDIDATE_BATCH_CAP/);
  assert.match(script,/JSON\.stringify\(\{runAt,providerCostEur,products:targetProducts,pipeline,catalogue,rawCandidates\}\)/);
  assert.equal(script.includes("status:'PROMOTED'"),false);
  assert.equal(script.includes("status:'SHORTLISTED'"),false);
});

test('Raw candidate discovery evidence is treated as proxy data, not paid or verified sales',async()=>{
  const script=await fs.readFile('scripts/stage0-supabase-sync.mjs','utf8');
  assert.match(script,/payload:\{engine:discovery\?\.engine/);
  assert.match(script,/validation:discovery\?\.validation/);
  assert.equal(script.includes('verifiedSales'),false);
  const workflow=await fs.readFile('.github/workflows/stage0-supabase-sync.yml','utf8');
  assert.equal(workflow.includes('dataforseo-keywords.mjs'),false);
  assert.equal(workflow.includes('provider-intelligence-v26.mjs'),false);
});
