-- Mega Product Radar · Product Universe V2
-- Historical marketplace observations for large FREE catalogue.

create table if not exists public.marketplace_product_snapshots (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  source_key text not null references public.data_sources(source_key),
  external_id text not null,
  marketplace text,
  observed_at timestamptz not null,
  title text not null,
  brand text,
  seller text,
  category_node_id uuid references public.category_nodes(id) on delete set null,
  source_url text,
  image_url text,
  price numeric(12,2),
  currency text,
  rating numeric(4,2) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer check (review_count is null or review_count >= 0),
  source_rank integer check (source_rank is null or source_rank > 0),
  estimated_units numeric,
  estimated_revenue numeric(14,2),
  sales_evidence_class text not null default 'UNKNOWN' check (sales_evidence_class in ('VERIFIED','ESTIMATED','DERIVED','UNKNOWN')),
  source_confidence numeric(5,2) check (source_confidence is null or (source_confidence >= 0 and source_confidence <= 100)),
  raw_ref text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_key, external_id, observed_at)
);
create index if not exists marketplace_product_snapshots_product_idx on public.marketplace_product_snapshots(product_id, observed_at desc);
create index if not exists marketplace_product_snapshots_category_idx on public.marketplace_product_snapshots(category_node_id, observed_at desc);
create index if not exists marketplace_product_snapshots_market_idx on public.marketplace_product_snapshots(marketplace, observed_at desc);
create index if not exists marketplace_product_snapshots_rank_idx on public.marketplace_product_snapshots(category_node_id, source_rank, observed_at desc);

create table if not exists public.product_universe_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text references public.data_sources(source_key),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  input_count integer not null default 0,
  valid_count integer not null default 0,
  invalid_count integer not null default 0,
  inserted_products integer not null default 0,
  inserted_snapshots integer not null default 0,
  duplicate_snapshots integer not null default 0,
  paid_cost_eur numeric(10,4) not null default 0 check (paid_cost_eur >= 0),
  status text not null default 'RUNNING' check (status in ('RUNNING','DONE','PARTIAL','FAILED','SKIPPED_BUDGET')),
  diagnostics jsonb not null default '{}'::jsonb
);
create index if not exists product_universe_ingest_runs_time_idx on public.product_universe_ingest_runs(started_at desc);

alter table public.marketplace_product_snapshots enable row level security;
alter table public.product_universe_ingest_runs enable row level security;

drop policy if exists "marketplace_product_snapshots_public_read" on public.marketplace_product_snapshots;
create policy "marketplace_product_snapshots_public_read" on public.marketplace_product_snapshots for select using (true);

-- Ingest diagnostics remain server-side; browser clients do not need operational internals.
revoke all on public.product_universe_ingest_runs from anon, authenticated;
revoke insert, update, delete on public.marketplace_product_snapshots from anon, authenticated;
