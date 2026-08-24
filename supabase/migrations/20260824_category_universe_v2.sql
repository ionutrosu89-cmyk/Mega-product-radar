-- Mega Product Radar · Category Universe V2
-- Canonical hierarchy for FREE market intelligence. No commercial promotion logic lives here.

create table if not exists public.category_nodes (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  label text not null,
  level text not null check (level in ('DEPARTMENT','CATEGORY','NICHE')),
  parent_id uuid references public.category_nodes(id) on delete restrict,
  source_taxonomy text not null default 'MPR_CANONICAL',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(level, category_key)
);
create index if not exists category_nodes_parent_idx on public.category_nodes(parent_id, level);

create table if not exists public.product_category_memberships (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  category_node_id uuid not null references public.category_nodes(id) on delete cascade,
  assignment_method text not null check (assignment_method in ('SOURCE','RULE','MODEL','MANUAL')),
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  evidence_ref text,
  assigned_at timestamptz not null default now(),
  unique(product_id, category_node_id)
);
create index if not exists product_category_memberships_product_idx on public.product_category_memberships(product_id);
create index if not exists product_category_memberships_category_idx on public.product_category_memberships(category_node_id, confidence desc);

create table if not exists public.category_market_snapshots (
  id bigint generated always as identity primary key,
  category_node_id uuid not null references public.category_nodes(id) on delete cascade,
  marketplace text not null,
  observed_at timestamptz not null,
  product_count integer,
  seller_count integer,
  brand_count integer,
  median_price numeric(12,2),
  estimated_units numeric,
  estimated_revenue numeric(14,2),
  review_barrier numeric,
  concentration_score numeric(5,2),
  confidence numeric(5,2) not null default 0,
  evidence jsonb not null default '{}'::jsonb
);
create index if not exists category_market_snapshots_lookup_idx on public.category_market_snapshots(category_node_id, marketplace, observed_at desc);

-- Taxonomy is readable market metadata; writes remain server-side.
alter table public.category_nodes enable row level security;
alter table public.product_category_memberships enable row level security;
alter table public.category_market_snapshots enable row level security;

drop policy if exists "category_nodes_public_read" on public.category_nodes;
create policy "category_nodes_public_read" on public.category_nodes for select using (active = true);

drop policy if exists "product_category_memberships_public_read" on public.product_category_memberships;
create policy "product_category_memberships_public_read" on public.product_category_memberships for select using (true);

drop policy if exists "category_market_snapshots_public_read" on public.category_market_snapshots;
create policy "category_market_snapshots_public_read" on public.category_market_snapshots for select using (true);

revoke insert, update, delete on public.category_nodes from anon, authenticated;
revoke insert, update, delete on public.product_category_memberships from anon, authenticated;
revoke insert, update, delete on public.category_market_snapshots from anon, authenticated;
