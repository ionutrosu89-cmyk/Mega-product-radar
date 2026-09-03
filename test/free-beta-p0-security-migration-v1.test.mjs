import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../supabase/migrations/20260903_free_beta_p0_security_and_rls_performance_v1.sql',import.meta.url),'utf8');

test('workspace membership helper moves outside the exposed public schema',()=>{
  assert.match(sql,/function private\.is_workspace_member/);
  assert.match(sql,/security definer/);
  assert.match(sql,/set search_path = ''/);
  assert.match(sql,/revoke all on function public\.is_workspace_member\(uuid\) from public, anon, authenticated/);
});

test('workspace creation becomes security invoker and is constrained by RLS',()=>{
  assert.match(sql,/function public\.create_personal_workspace/);
  assert.match(sql,/security invoker/);
  assert.match(sql,/workspace_owner_insert/);
  assert.match(sql,/workspace_owner_member_insert/);
  assert.match(sql,/workspace_owner_subscription_insert/);
});

test('auth uid policies use initplan form and critical tenant keys are indexed',()=>{
  assert.doesNotMatch(sql,/[^\w]auth\.uid\(\)(?!\))/);
  for(const index of ['workspace_members_user_id_idx','workspaces_owner_id_idx','products_workspace_id_idx','suppliers_workspace_id_idx'])assert.match(sql,new RegExp(index));
});
