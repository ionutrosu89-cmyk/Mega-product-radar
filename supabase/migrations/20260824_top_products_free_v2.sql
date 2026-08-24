-- Mega Product Radar · FREE Top Products V2
-- Stores generated category/niche ranking snapshots. Ranking is intelligence, not verified sales.

create table if not exists public.category_top_product_snapshots (
  id bigint generated always as identity primary key,
  category_node_id uuid not null references public.category_nodes(id) on delete cascade,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  marketplace text,
  snapshot_at timestamptz not null,
  mpr_rank integer not null check (mpr_rank > 0 and mpr_rank <= 100),
  market_score numeric(5,2) not null check (market_score >= 0 and market_score <= 100),
  metric_coverage_pct numeric(5,2) not null check (metric_coverage_pct >= 0 and metric_coverage_pct <= 100),
  source_rank integer check (source_rank is null or source_rank > 0),
  price numeric(12,2),
  currency text,
  rating numeric(4,2),
  review_count integer,
  estimated_units numeric,
  estimated_revenue numeric(14,2),
  sales_evidence_class text not null default 'UNKNOWN' check (sales_evidence_class in ('VERIFIED','ESTIMATED','DERIVED','UNKNOWN')),
  source_confidence numeric(5,2),
  components jsonb not null default '{}'::jsonb,
  policy_version text not null default 'MPR_MARKET_SCORE_V2',
  created_at timestamptz not null default now(),
  unique(category_node_id, product_id, snapshot_at)
);
create index if not exists category_top_product_snapshots_rank_idx on public.category_top_product_snapshots(category_node_id, snapshot_at desc, mpr_rank asc);
create index if not exists category_top_product_snapshots_product_idx on public.category_top_product_snapshots(product_id, snapshot_at desc);

alter table public.category_top_product_snapshots enable row level security;
drop policy if exists "category_top_product_snapshots_public_read" on public.category_top_product_snapshots;
create policy "category_top_product_snapshots_public_read" on public.category_top_product_snapshots for select using (true);
revoke insert, update, delete on public.category_top_product_snapshots from anon, authenticated;
