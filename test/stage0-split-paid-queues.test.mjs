import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Romania keyword and deep marketplace queues stay separated behind secure OIDC transport',async()=>{
  const sync=await fs.readFile('scripts/stage0-budget-brain-sync.mjs','utf8');
  const provider=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  const helper=await fs.readFile('scripts/lib/stage0-secure-targets.mjs','utf8');
  const migration=await fs.readFile('supabase/migrations/20260823_split_stage0_ro_and_deep_paid_targets.sql','utf8');
  assert.match(sync,/readStage0Targets\('RO'\)/);
  assert.match(sync,/Browser\/public RPC access is not used/);
  assert.match(provider,/readStage0Targets\('DEEP'\)/);
  assert.match(provider,/BLOCKED_DEEP_ALLOWLIST_UNAVAILABLE/);
  assert.match(provider,/OIDC_STAGE0_DEEP_MARKETPLACE/);
  assert.match(helper,/\['RO','DEEP'\]/);
  assert.doesNotMatch(sync,/\/rest\/v1\/rpc\/stage0_/);
  assert.doesNotMatch(provider,/\/rest\/v1\/rpc\/stage0_/);
  assert.match(migration,/when 'VALIDATE' then 120 when 'PROMISING' then 80/);
  assert.match(migration,/create or replace function public\.stage0_ro_keyword_targets/);
  assert.match(migration,/create or replace function public\.stage0_deep_marketplace_targets/);
});

test('deep provider restores original Golden Pipeline rank after isolated priority mapping',async()=>{
  const provider=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  assert.match(provider,/rank:index\+1/);
  assert.match(provider,/goldenPipeline:p\?\.goldenPipeline/);
  assert.match(provider,/deepProviderPriority:index\+1/);
});
