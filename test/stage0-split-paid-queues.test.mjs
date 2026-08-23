import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Romania keyword and deep marketplace queues are separated',async()=>{
  const sync=await fs.readFile('scripts/stage0-budget-brain-sync.mjs','utf8');
  const provider=await fs.readFile('scripts/provider-intelligence-stage0.mjs','utf8');
  const migration=await fs.readFile('supabase/migrations/20260823_split_stage0_ro_and_deep_paid_targets.sql','utf8');
  assert.match(sync,/stage0_paid_targets/);
  assert.match(sync,/Recent Romania cache hits are excluded/);
  assert.match(provider,/stage0_deep_marketplace_targets/);
  assert.match(provider,/BLOCKED_DEEP_ALLOWLIST_UNAVAILABLE/);
  assert.match(provider,/SUPABASE_STAGE0_DEEP_MARKETPLACE/);
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
