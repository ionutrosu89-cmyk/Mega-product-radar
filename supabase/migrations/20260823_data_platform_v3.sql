-- Mega Product Radar · Data Platform V3
-- Append-only observations + product identity + provenance + budget/freshness + supplier intelligence.

create extension if not exists pgcrypto;

create table if not exists public.canonical_products (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  title text not null,
  brand text,
  category text,
  image_url text,
  status text not null default 'DISCOVERED' check (status in ('DISCOVERED','PROMISING','VALIDATE','FINALIST','TEST_READY','BUY_READY','ARCHIVED')),
  opportunity_score numeric(5,2),
  evidence_confidence numeric(5,2) not null default 0,
  priority_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_aliases (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  source text not null,
  external_id text not null,
  marketplace text,
  title text,
  url text,
  fingerprint text,
  created_at timestamptz not null default now(),
  unique(source, external_id)
);
create index if not exists product_aliases_product_idx on public.product_aliases(product_id);
create index if not exists product_aliases_fingerprint_idx on public.product_aliases(fingerprint);

create table if not exists public.data_sources (
  source_key text primary key,
  provider text not null,
  collection_method text not null,
  allowed_use text not null default 'internal_analytics',
  redistribution_right text not null default 'unknown',
  retention_rule text not null default 'review_required',
  paid boolean not null default false,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.product_observations (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  source_key text not null references public.data_sources(source_key),
  observation_type text not null,
  observed_at timestamptz not null,
  numeric_value numeric,
  text_value text,
  currency text,
  confidence numeric(5,2),
  raw_ref text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(product_id, source_key, observation_type, observed_at)
);
create index if not exists product_observations_lookup_idx on public.product_observations(product_id, observation_type, observed_at desc);
create index if not exists product_observations_source_idx on public.product_observations(source_key, observed_at desc);

create table if not exists public.data_cost_ledger (
  id bigint generated always as identity primary key,
  incurred_at timestamptz not null default now(),
  source_key text references public.data_sources(source_key),
  product_id uuid references public.canonical_products(id) on delete set null,
  operation text not null,
  units numeric not null default 1,
  cost_eur numeric(10,4) not null check (cost_eur >= 0),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists data_cost_ledger_month_idx on public.data_cost_ledger(incurred_at desc);

create table if not exists public.data_budget_policy (
  id boolean primary key default true check (id),
  monthly_hard_cap_eur numeric(10,2) not null default 100,
  soft_stop_eur numeric(10,2) not null default 80,
  reserve_eur numeric(10,2) not null default 20,
  max_single_validation_eur numeric(10,2) not null default 3,
  updated_at timestamptz not null default now()
);
insert into public.data_budget_policy(id) values (true) on conflict (id) do nothing;

create table if not exists public.refresh_queue (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  tier text not null check (tier in ('HOT','ACTIVE','DISCOVERY','LONG_TAIL')),
  reason text not null,
  due_at timestamptz not null,
  estimated_cost_eur numeric(10,4) not null default 0,
  information_value numeric(5,2) not null default 0,
  state text not null default 'PENDING' check (state in ('PENDING','RUNNING','DONE','SKIPPED_BUDGET','FAILED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists refresh_queue_due_idx on public.refresh_queue(state, due_at, information_value desc);

create table if not exists public.romania_market_snapshots (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  observed_at timestamptz not null default now(),
  keyword text,
  search_volume numeric,
  trend_30d numeric,
  trend_90d numeric,
  median_price_ron numeric,
  listing_count integer,
  seller_count integer,
  review_barrier numeric,
  competition_score numeric(5,2),
  demand_score numeric(5,2),
  romania_gap_score numeric(5,2),
  confidence numeric(5,2) not null default 0,
  evidence jsonb not null default '{}'::jsonb
);
create index if not exists romania_market_product_idx on public.romania_market_snapshots(product_id, observed_at desc);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  display_name text not null,
  country text,
  verified_level text not null default 'UNVERIFIED' check (verified_level in ('UNVERIFIED','EVIDENCE_CHECKED','AGENT_TESTED')),
  agent_notes text,
  created_at timestamptz not null default now(),
  unique(source, external_id)
);

create table if not exists public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  quoted_at timestamptz not null default now(),
  unit_price numeric(12,4),
  currency text,
  moq integer,
  sample_cost numeric(12,4),
  lead_time_days integer,
  incoterm text,
  certifications jsonb not null default '[]'::jsonb,
  shipping_estimate_eur numeric(12,2),
  evidence_ref text,
  confidence numeric(5,2) not null default 0
);

create table if not exists public.landed_cost_runs_v3 (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  supplier_quote_id uuid references public.supplier_quotes(id) on delete set null,
  quantity integer not null check (quantity > 0),
  goods_cost_eur numeric(12,2) not null default 0,
  freight_eur numeric(12,2) not null default 0,
  duty_eur numeric(12,2) not null default 0,
  vat_eur numeric(12,2) not null default 0,
  compliance_eur numeric(12,2) not null default 0,
  other_eur numeric(12,2) not null default 0,
  landed_unit_eur numeric(12,4) not null,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  decision text not null check (decision in ('TEST','HOLD','BUY','REJECT')),
  predicted_at timestamptz,
  test_started_at timestamptz,
  measured_at timestamptz,
  units_tested integer,
  units_sold integer,
  revenue_ron numeric(12,2),
  net_margin_pct numeric(6,2),
  returns_count integer,
  outcome jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.commercial_outcomes enable row level security;
drop policy if exists "commercial_outcomes_own" on public.commercial_outcomes;
create policy "commercial_outcomes_own" on public.commercial_outcomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view public.data_budget_monthly as
select date_trunc('month', now()) as month,
       coalesce(sum(cost_eur) filter (where incurred_at >= date_trunc('month', now())), 0)::numeric(10,2) as spent_eur,
       p.monthly_hard_cap_eur,
       p.soft_stop_eur,
       greatest(p.monthly_hard_cap_eur - coalesce(sum(cost_eur) filter (where incurred_at >= date_trunc('month', now())), 0), 0)::numeric(10,2) as remaining_eur
from public.data_cost_ledger cross join public.data_budget_policy p
group by p.monthly_hard_cap_eur, p.soft_stop_eur;
