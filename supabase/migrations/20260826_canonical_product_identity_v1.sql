-- P0 Canonical Product Identity V1
-- A canonical product UUID is the stable business identity. Marketplace IDs are aliases.
-- Title similarity is never sufficient for automatic cross-platform merging.

create table if not exists public.canonical_products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text,
  canonical_category text,
  identity_status text not null default 'ACTIVE' check (identity_status in ('ACTIVE','MERGED','REVIEW','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_product_id uuid not null references public.canonical_products(id) on delete cascade,
  platform text not null,
  external_id text not null,
  market text,
  observed_title text,
  title_fingerprint text,
  source_url text,
  match_method text not null default 'EXACT_SOURCE_ID' check (match_method in ('EXACT_SOURCE_ID','MANUAL_REVIEW','MIGRATED_LEGACY')),
  manually_reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform,external_id)
);

create index if not exists product_aliases_canonical_product_idx on public.product_aliases(canonical_product_id);
create index if not exists product_aliases_title_fingerprint_idx on public.product_aliases(title_fingerprint) where title_fingerprint is not null;

-- Product identity is global application infrastructure, not browser-owned mutable tenant state.
alter table public.canonical_products enable row level security;
alter table public.product_aliases enable row level security;

-- Authenticated users may read canonical identities, while browser writes remain disabled.
drop policy if exists canonical_products_authenticated_read on public.canonical_products;
create policy canonical_products_authenticated_read on public.canonical_products for select to authenticated using (true);

drop policy if exists product_aliases_authenticated_read on public.product_aliases;
create policy product_aliases_authenticated_read on public.product_aliases for select to authenticated using (true);

revoke insert,update,delete on public.canonical_products from anon,authenticated;
revoke insert,update,delete on public.product_aliases from anon,authenticated;

-- Candidate-specific commercial records gain an optional canonical binding without breaking legacy rows.
alter table if exists public.suppliers add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.supplier_offers add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.rfq_dispatch_states add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.landed_costs add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.purchases add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.portfolio_items add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.feedback_events add column if not exists canonical_product_id uuid references public.canonical_products(id);
alter table if exists public.discovery_candidates add column if not exists canonical_product_id uuid references public.canonical_products(id);

create index if not exists suppliers_canonical_product_idx on public.suppliers(canonical_product_id);
create index if not exists supplier_offers_canonical_product_idx on public.supplier_offers(canonical_product_id);
create index if not exists rfq_dispatch_states_canonical_product_idx on public.rfq_dispatch_states(canonical_product_id);
create index if not exists landed_costs_canonical_product_idx on public.landed_costs(canonical_product_id);
create index if not exists purchases_canonical_product_idx on public.purchases(canonical_product_id);
create index if not exists portfolio_items_canonical_product_idx on public.portfolio_items(canonical_product_id);
create index if not exists feedback_events_canonical_product_idx on public.feedback_events(canonical_product_id);
create index if not exists discovery_candidates_canonical_product_idx on public.discovery_candidates(canonical_product_id);
