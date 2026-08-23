-- Mega Product Radar · Data Platform V3 operational hardening

alter table public.canonical_products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.data_sources enable row level security;
alter table public.product_observations enable row level security;
alter table public.data_cost_ledger enable row level security;
alter table public.data_budget_policy enable row level security;
alter table public.refresh_queue enable row level security;
alter table public.romania_market_snapshots enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.landed_cost_runs_v3 enable row level security;

create or replace view public.data_budget_monthly
with (security_invoker = true)
as
select date_trunc('month', now()) as month,
       coalesce(sum(l.cost_eur) filter (where l.incurred_at >= date_trunc('month', now())), 0)::numeric(10,2) as spent_eur,
       p.monthly_hard_cap_eur,
       p.soft_stop_eur,
       greatest(p.monthly_hard_cap_eur - coalesce(sum(l.cost_eur) filter (where l.incurred_at >= date_trunc('month', now())), 0), 0)::numeric(10,2) as remaining_eur
from public.data_budget_policy p
left join public.data_cost_ledger l on true
group by p.monthly_hard_cap_eur, p.soft_stop_eur;

revoke all on public.canonical_products, public.product_aliases, public.data_sources,
  public.product_observations, public.data_cost_ledger, public.data_budget_policy,
  public.refresh_queue, public.romania_market_snapshots, public.suppliers,
  public.supplier_quotes, public.landed_cost_runs_v3 from anon, authenticated;
revoke all on public.data_budget_monthly from anon, authenticated;

create extension if not exists pg_cron;

create or replace function public.enqueue_data_refreshes_v3()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  insert into public.refresh_queue(product_id,tier,reason,due_at,estimated_cost_eur,information_value)
  select p.id,
         case
           when p.status in ('FINALIST','TEST_READY') or p.priority_score >= 90 then 'HOT'
           when p.status in ('PROMISING','VALIDATE') or p.priority_score >= 60 then 'ACTIVE'
           when p.status = 'DISCOVERED' and p.priority_score >= 20 then 'DISCOVERY'
           else 'LONG_TAIL'
         end,
         'Freshness Engine V3', now(), 0,
         least(100, greatest(0, coalesce(p.priority_score,0)))
  from public.canonical_products p
  where p.status <> 'ARCHIVED'
    and not exists (
      select 1 from public.refresh_queue q
      where q.product_id=p.id and q.state in ('PENDING','RUNNING')
    )
    and (
      (p.status in ('FINALIST','TEST_READY') and p.updated_at <= now()-interval '1 hour') or
      (p.status in ('PROMISING','VALIDATE') and p.updated_at <= now()-interval '12 hours') or
      (p.status='DISCOVERED' and p.priority_score >= 20 and p.updated_at <= now()-interval '72 hours') or
      (p.priority_score < 20 and p.updated_at <= now()-interval '30 days')
    );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_data_refreshes_v3() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname='mpr_v3_refresh_queue_hourly';
select cron.schedule('mpr_v3_refresh_queue_hourly','5 * * * *',$$select public.enqueue_data_refreshes_v3();$$);