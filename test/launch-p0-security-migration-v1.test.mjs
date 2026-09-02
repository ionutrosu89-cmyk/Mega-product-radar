import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../supabase/migrations/20260902_launch_p0_rls_and_internal_views_v1.sql',import.meta.url),'utf8');

test('launch P0 migration enables RLS and removes browser privileges from internal tables',()=>{
  for(const table of ['romania_benchmark_membership','romania_scale_10000_membership_v1','brand_exclusion_policy_v1']){
    assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,'i'));
  }
  assert.match(sql,/revoke all privileges on table[\s\S]*from anon, authenticated/i);
  assert.match(sql,/to service_role/i);
});

test('launch P0 migration makes internal views security invoker and revokes browser access',()=>{
  for(const view of [
    'commercial_filter_v1','trend_signal_v1','romania_gap_signal_v1','importability_signal_v1',
    'economics_readiness_v1','opportunity_decision_v1','intelligence_funnel_summary_v1',
    'intelligence_priority_queue_v1','romania_independent_surface_coverage_v1',
    'importability_ai_review_assist_v1','golden_set_review_packet_v1',
    'golden_set_commercial_queue_v1','brand_policy_gate_v1'
  ])assert.match(sql,new RegExp(`'${view}'`));
  assert.match(sql,/alter view public\.%I set \(security_invoker=true\)/i);
  assert.match(sql,/revoke all privileges on table public\.%I from anon, authenticated/i);
});

test('launch P0 migration restricts the privileged refresh RPC to service role',()=>{
  assert.match(sql,/revoke execute on function public\.enqueue_data_refreshes_v4\(\) from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.enqueue_data_refreshes_v4\(\) to service_role/i);
  assert.match(sql,/set search_path = pg_catalog, public/i);
});
