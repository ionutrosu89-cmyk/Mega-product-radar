-- Mega Product Radar · Seller & Brand Intelligence V1
-- Market graph for FREE intelligence. Supplier entities remain separate.

create table if not exists public.marketplace_sellers (
  id uuid primary key default gen_random_uuid(),
  marketplace text not null,
  external_id text,
  display_name text not null,
  country text,
  source_url text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(marketplace, external_id)
);

create table if not exists public.market_brands (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,
  display_name text not null,
  source_url text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.product_seller_observations (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  seller_id uuid not null references public.marketplace_sellers(id) on delete cascade,
  observed_at timestamptz not null,
  source_key text not null references public.data_sources(source_key),
  is_primary_offer boolean,
  price numeric(12,2),
  currency text,
  evidence_ref text,
  unique(product_id, seller_id, source_key, observed_at)
);
create index if not exists product_seller_observations_lookup_idx on public.product_seller_observations(product_id, observed_at desc);

create table if not exists public.product_brand_relationships (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  brand_id uuid not null references public.market_brands(id) on delete cascade,
  observed_at timestamptz not null,
  source_key text not null references public.data_sources(source_key),
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 100)),
  evidence_ref text,
  unique(product_id, brand_id, source_key, observed_at)
);
create index if not exists product_brand_relationships_lookup_idx on public.product_brand_relationships(product_id, observed_at desc);

create table if not exists public.category_entity_snapshots (
  id bigint generated always as identity primary key,
  category_node_id uuid not null references public.category_nodes(id) on delete cascade,
  entity_type text not null check (entity_type in ('SELLER','BRAND')),
  entity_key text not null,
  snapshot_at timestamptz not null,
  mpr_rank integer check (mpr_rank is null or (mpr_rank > 0 and mpr_rank <= 100)),
  product_count integer not null default 0,
  estimated_units numeric,
  estimated_revenue numeric(14,2),
  revenue_evidence_class text not null default 'UNKNOWN' check (revenue_evidence_class in ('VERIFIED','ESTIMATED','DERIVED','UNKNOWN')),
  share_pct numeric(6,2),
  source_confidence numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  unique(category_node_id, entity_type, entity_key, snapshot_at)
);
create index if not exists category_entity_snapshots_rank_idx on public.category_entity_snapshots(category_node_id, entity_type, snapshot_at desc, mpr_rank asc);

alter table public.marketplace_sellers enable row level security;
alter table public.market_brands enable row level security;
alter table public.product_seller_observations enable row level security;
alter table public.product_brand_relationships enable row level security;
alter table public.category_entity_snapshots enable row level security;

drop policy if exists "marketplace_sellers_public_read" on public.marketplace_sellers;
create policy "marketplace_sellers_public_read" on public.marketplace_sellers for select using (true);
drop policy if exists "market_brands_public_read" on public.market_brands;
create policy "market_brands_public_read" on public.market_brands for select using (true);
drop policy if exists "product_seller_observations_public_read" on public.product_seller_observations;
create policy "product_seller_observations_public_read" on public.product_seller_observations for select using (true);
drop policy if exists "product_brand_relationships_public_read" on public.product_brand_relationships;
create policy "product_brand_relationships_public_read" on public.product_brand_relationships for select using (true);
drop policy if exists "category_entity_snapshots_public_read" on public.category_entity_snapshots;
create policy "category_entity_snapshots_public_read" on public.category_entity_snapshots for select using (true);

revoke insert, update, delete on public.marketplace_sellers from anon, authenticated;
revoke insert, update, delete on public.market_brands from anon, authenticated;
revoke insert, update, delete on public.product_seller_observations from anon, authenticated;
revoke insert, update, delete on public.product_brand_relationships from anon, authenticated;
revoke insert, update, delete on public.category_entity_snapshots from anon, authenticated;
