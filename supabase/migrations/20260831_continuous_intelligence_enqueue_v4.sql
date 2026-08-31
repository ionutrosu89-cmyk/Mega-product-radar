-- Continuous Intelligence enqueue v4
-- Makes the hourly catalog scheduler compatible with refresh_queue v2.
-- Global refresh intents are explicitly scoped and fail closed on provider spend/purchase authority.

create or replace function public.enqueue_data_refreshes_v4()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  inserted_count integer;
begin
  insert into public.refresh_queue(
    product_id,
    tier,
    reason,
    due_at,
    estimated_cost_eur,
    information_value,
    state,
    target_surface,
    evidence_kind,
    priority_score,
    shard_key,
    dedupe_key,
    provider_policy
  )
  select
    p.id,
    case
      when p.status in ('FINALIST','TEST_READY') or p.priority_score >= 90 then 'HOT'
      when p.status in ('PROMISING','VALIDATE') or p.priority_score >= 60 then 'ACTIVE'
      when p.status = 'DISCOVERED' and p.priority_score >= 20 then 'DISCOVERY'
      else 'LONG_TAIL'
    end,
    'continuous_intelligence_global_refresh_v4',
    now(),
    0,
    least(100, greatest(0, coalesce(p.priority_score,0))),
    'PENDING',
    'GLOBAL',
    'GLOBAL_PRODUCT_REFRESH',
    least(100, greatest(0, coalesce(p.priority_score,0))),
    'GLOBAL_' || substr(replace(p.id::text, '-', ''), 1, 2),
    'GLOBAL:PRODUCT:' || p.id::text || ':REFRESH_V4',
    jsonb_build_object(
      'paid_calls_allowed', false,
      'purchase_authorized', false,
      'unknown_remains_unknown', true,
      'verified_sales_required_for_sales_claims', true
    )
  from public.canonical_products p
  where p.status <> 'ARCHIVED'
    and not exists (
      select 1
      from public.refresh_queue q
      where q.product_id = p.id
        and q.target_surface = 'GLOBAL'
        and q.evidence_kind = 'GLOBAL_PRODUCT_REFRESH'
        and q.state in ('PENDING','LEASED','IN_PROGRESS','RUNNING')
    )
    and (
      (p.status in ('FINALIST','TEST_READY') and p.updated_at <= now()-interval '1 hour') or
      (p.status in ('PROMISING','VALIDATE') and p.updated_at <= now()-interval '12 hours') or
      (p.status='DISCOVERED' and p.priority_score >= 20 and p.updated_at <= now()-interval '72 hours') or
      (coalesce(p.priority_score,0) < 20 and p.updated_at <= now()-interval '30 days')
    )
  on conflict (dedupe_key) where dedupe_key is not null and state in ('PENDING','LEASED','IN_PROGRESS')
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

-- Keep the existing named hourly job and cadence, but update it through pg_cron's supported API.
select cron.schedule(
  'mpr_v3_refresh_queue_hourly',
  '5 * * * *',
  'select public.enqueue_data_refreshes_v4();'
);
