import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=p=>fs.readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('Stage 0 paid target readers use GitHub OIDC edge and never public Supabase RPC credentials',async()=>{
  const [ro,deep,helper]=await Promise.all([read('scripts/stage0-budget-brain-sync.mjs'),read('scripts/provider-intelligence-stage0.mjs'),read('scripts/lib/stage0-secure-targets.mjs')]);
  for(const src of [ro,deep]){
    assert.match(src,/readStage0Targets/);
    assert.doesNotMatch(src,/sb_publishable_/);
    assert.doesNotMatch(src,/\/rest\/v1\/rpc\/stage0_/);
  }
  assert.match(helper,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(helper,/mega-product-radar-supabase/);
  assert.match(helper,/functions\/v1\/stage0-targets/);
});

test('Radar workflow has OIDC permission and does not trigger paid scan merely because its own file changed',async()=>{
  const yml=await read('.github/workflows/radar-scan.yml');
  assert.match(yml,/id-token:\s*write/);
  assert.doesNotMatch(yml,/^\s*- ['"]?\.github\/workflows\/radar-scan\.yml['"]?\s*$/m);
  assert.match(yml,/stage0-budget-brain-sync\.mjs/);
  assert.match(yml,/provider-intelligence-stage0\.mjs/);
});

test('Stage 0 target RPCs revoke PUBLIC browser execution and remain available only to service_role',async()=>{
  const sql=await read('supabase/migrations/20260824_stage0_rpc_hardening.sql');
  for(const fn of ['stage0_ro_keyword_targets','stage0_deep_marketplace_targets','stage0_paid_targets']){
    assert.match(sql,new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public, anon, authenticated`,'i'));
    assert.match(sql,new RegExp(`grant execute on function public\\.${fn}\\(\\) to service_role`,'i'));
  }
});
