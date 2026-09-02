-- Launch P0 hardening.
-- Internal benchmark/policy tables and decision views are service-owned control-plane data.
-- Browser roles must not read or mutate them through the Supabase Data API.

begin;

alter table public.romania_benchmark_membership enable row level security;
alter table public.romania_scale_10000_membership_v1 enable row level security;
alter table public.brand_exclusion_policy_v1 enable row level security;

revoke all privileges on table
  public.romania_benchmark_membership,
  public.romania_scale_10000_membership_v1,
  public.brand_exclusion_policy_v1
from anon, authenticated;

grant select, insert, update, delete on table
  public.romania_benchmark_membership,
  public.romania_scale_10000_membership_v1,
  public.brand_exclusion_policy_v1
to service_role;

comment on table public.romania_benchmark_membership is
'Internal Romania benchmark membership. Browser roles are intentionally denied; service-role pipelines only.';
comment on table public.romania_scale_10000_membership_v1 is
'Internal Romania scale target membership. Browser roles are intentionally denied; service-role pipelines only.';
comment on table public.brand_exclusion_policy_v1 is
'Internal brand-policy control data. Browser roles are intentionally denied; service-role pipelines only.';

do $block$
declare
  view_name text;
begin
  foreach view_name in array array[
    'commercial_filter_v1',
    'trend_signal_v1',
    'romania_gap_signal_v1',
    'importability_signal_v1',
    'economics_readiness_v1',
    'opportunity_decision_v1',
    'intelligence_funnel_summary_v1',
    'intelligence_priority_queue_v1',
    'romania_independent_surface_coverage_v1',
    'importability_ai_review_assist_v1',
    'golden_set_review_packet_v1',
    'golden_set_commercial_queue_v1',
    'brand_policy_gate_v1'
  ]
  loop
    execute format('alter view public.%I set (security_invoker=true)', view_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', view_name);
    execute format('grant select on table public.%I to service_role', view_name);
  end loop;
end
$block$;

revoke execute on function public.enqueue_data_refreshes_v4() from public, anon, authenticated;
grant execute on function public.enqueue_data_refreshes_v4() to service_role;
alter function public.enqueue_data_refreshes_v4() set search_path = pg_catalog, public;

commit;
