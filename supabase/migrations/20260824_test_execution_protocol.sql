create table if not exists public.test_execution_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_key text not null,
  product_key text not null,
  product_name text not null,
  status text not null default 'PLANNED' check (status in ('PLANNED','RUNNING','MEASURED')),
  authorized_at timestamptz not null,
  decision_snapshot jsonb not null default '{}'::jsonb,
  planned_quantity integer not null check (planned_quantity between 20 and 30),
  landed_per_unit numeric not null check (landed_per_unit > 0),
  target_sale_price numeric not null check (target_sale_price > 0),
  max_test_budget numeric not null check (max_test_budget > 0),
  order_reference text,
  started_at timestamptz,
  measured_at timestamptz,
  units_received integer check (units_received is null or units_received >= 0),
  units_sold integer check (units_sold is null or units_sold >= 0),
  revenue_ron numeric check (revenue_ron is null or revenue_ron >= 0),
  ad_spend_ron numeric check (ad_spend_ron is null or ad_spend_ron >= 0),
  marketplace_fees_ron numeric check (marketplace_fees_ron is null or marketplace_fees_ron >= 0),
  fulfillment_cost_ron numeric check (fulfillment_cost_ron is null or fulfillment_cost_ron >= 0),
  returns_count integer check (returns_count is null or returns_count >= 0),
  returns_cost_ron numeric check (returns_cost_ron is null or returns_cost_ron >= 0),
  other_costs_ron numeric check (other_costs_ron is null or other_costs_ron >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, run_key),
  check ((status = 'PLANNED') or (started_at is not null and length(trim(coalesce(order_reference,''))) > 0)),
  check ((status <> 'MEASURED') or (
    measured_at is not null and units_received is not null and units_sold is not null and
    revenue_ron is not null and ad_spend_ron is not null and marketplace_fees_ron is not null and
    fulfillment_cost_ron is not null and returns_count is not null and returns_cost_ron is not null and other_costs_ron is not null and
    units_sold <= units_received and returns_count <= units_sold
  ))
);

create index if not exists test_execution_workspace_product_idx on public.test_execution_records(workspace_id, product_key, created_at desc);
alter table public.test_execution_records enable row level security;
drop policy if exists test_execution_member on public.test_execution_records;
create policy test_execution_member on public.test_execution_records for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
