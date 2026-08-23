create or replace view public.data_platform_product_health_v3
with (security_invoker = true)
as
select
  cp.id,
  cp.canonical_key,
  cp.title,
  cp.status,
  cp.opportunity_score,
  cp.evidence_confidence,
  cp.priority_score,
  obs.last_observed_at,
  ro.last_romania_observed_at,
  rq.tier as refresh_tier,
  rq.due_at as refresh_due_at,
  case
    when rq.due_at is null then 'UNSCHEDULED'
    when rq.due_at <= now() then 'DUE'
    else 'FRESH'
  end as freshness_status,
  greatest(
    coalesce(obs.last_observed_at, '-infinity'::timestamptz),
    coalesce(ro.last_romania_observed_at, '-infinity'::timestamptz),
    cp.updated_at
  ) as last_intelligence_at
from public.canonical_products cp
left join lateral (
  select max(po.observed_at) as last_observed_at
  from public.product_observations po
  where po.product_id = cp.id
) obs on true
left join lateral (
  select max(rms.observed_at) as last_romania_observed_at
  from public.romania_market_snapshots rms
  where rms.product_id = cp.id
) ro on true
left join lateral (
  select q.tier, q.due_at
  from public.refresh_queue q
  where q.product_id = cp.id and q.state = 'PENDING'
  order by q.due_at asc, q.id desc
  limit 1
) rq on true;

create or replace view public.data_platform_health_v3
with (security_invoker = true)
as
with month_cost as (
  select coalesce(sum(cost_eur),0)::numeric as spent_eur
  from public.data_cost_ledger
  where incurred_at >= date_trunc('month', now())
),
policy as (
  select monthly_hard_cap_eur, soft_stop_eur, reserve_eur
  from public.data_budget_policy
  where id = true
  limit 1
),
product_stats as (
  select
    count(*)::bigint as canonical_products,
    count(*) filter (where status='DISCOVERED')::bigint as discovered,
    count(*) filter (where status='PROMISING')::bigint as promising,
    count(*) filter (where status='VALIDATE')::bigint as validate,
    count(*) filter (where status='FINALIST')::bigint as finalist,
    count(*) filter (where status='TEST_READY')::bigint as test_ready,
    count(*) filter (where freshness_status='DUE')::bigint as refresh_due,
    count(*) filter (where freshness_status='UNSCHEDULED')::bigint as refresh_unscheduled,
    count(*) filter (where last_romania_observed_at is not null)::bigint as romania_covered
  from public.data_platform_product_health_v3
),
other_stats as (
  select
    (select count(*) from public.product_aliases)::bigint as aliases,
    (select count(*) from public.product_observations)::bigint as observations,
    (select count(*) from public.romania_market_snapshots)::bigint as romania_snapshots,
    (select count(*) from public.data_cost_ledger)::bigint as cost_events
)
select
  ps.*,
  os.aliases,
  os.observations,
  os.romania_snapshots,
  os.cost_events,
  mc.spent_eur,
  p.soft_stop_eur,
  p.monthly_hard_cap_eur,
  p.reserve_eur,
  greatest(coalesce(p.soft_stop_eur,80)-mc.spent_eur,0)::numeric as available_before_soft_stop_eur,
  greatest(coalesce(p.monthly_hard_cap_eur,100)-mc.spent_eur,0)::numeric as hard_cap_remaining_eur,
  case
    when mc.spent_eur >= coalesce(p.monthly_hard_cap_eur,100) then 'HARD_STOP'
    when mc.spent_eur >= coalesce(p.soft_stop_eur,80) then 'SOFT_STOP'
    else 'OPEN'
  end as budget_state,
  now() as measured_at
from product_stats ps cross join other_stats os cross join month_cost mc left join policy p on true;

revoke all on public.data_platform_product_health_v3 from anon, authenticated;
revoke all on public.data_platform_health_v3 from anon, authenticated;
grant select on public.data_platform_product_health_v3 to service_role;
grant select on public.data_platform_health_v3 to service_role;
