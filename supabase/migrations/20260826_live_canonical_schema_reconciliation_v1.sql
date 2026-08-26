-- Reconcile the pre-existing production canonical identity tables with the P0/P1 contract.
-- This migration is intentionally additive and non-destructive.
-- Existing canonical_products/product_aliases rows remain intact and legacy columns stay readable.

-- canonical_products: add the new identity-contract columns while preserving legacy columns.
alter table public.canonical_products add column if not exists canonical_name text;
alter table public.canonical_products add column if not exists canonical_category text;
alter table public.canonical_products add column if not exists identity_status text;

update public.canonical_products
set canonical_name = coalesce(canonical_name, title),
    canonical_category = coalesce(canonical_category, category),
    identity_status = coalesce(identity_status,
      case
        when status = 'ARCHIVED' then 'ARCHIVED'
        else 'ACTIVE'
      end)
where canonical_name is null or canonical_category is null or identity_status is null;

alter table public.canonical_products alter column identity_status set default 'ACTIVE';
alter table public.canonical_products alter column identity_status set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='canonical_products_identity_status_check' and conrelid='public.canonical_products'::regclass) then
    alter table public.canonical_products add constraint canonical_products_identity_status_check
      check (identity_status in ('ACTIVE','MERGED','REVIEW','ARCHIVED'));
  end if;
end $$;

-- product_aliases: preserve bigint legacy primary key, but add canonical contract columns.
alter table public.product_aliases add column if not exists canonical_product_id uuid;
alter table public.product_aliases add column if not exists platform text;
alter table public.product_aliases add column if not exists market text;
alter table public.product_aliases add column if not exists observed_title text;
alter table public.product_aliases add column if not exists title_fingerprint text;
alter table public.product_aliases add column if not exists source_url text;
alter table public.product_aliases add column if not exists match_method text;
alter table public.product_aliases add column if not exists manually_reviewed boolean;
alter table public.product_aliases add column if not exists updated_at timestamptz;

update public.product_aliases
set canonical_product_id = coalesce(canonical_product_id, product_id),
    platform = coalesce(nullif(platform,''), upper(regexp_replace(coalesce(source,'LEGACY'), '[^A-Za-z0-9]+', '_', 'g'))),
    market = coalesce(market, marketplace),
    observed_title = coalesce(observed_title, title),
    title_fingerprint = coalesce(title_fingerprint, fingerprint),
    source_url = coalesce(source_url, url),
    match_method = coalesce(match_method, 'MIGRATED_LEGACY'),
    manually_reviewed = coalesce(manually_reviewed, false),
    updated_at = coalesce(updated_at, created_at, now())
where canonical_product_id is null
   or platform is null or platform=''
   or match_method is null
   or manually_reviewed is null
   or updated_at is null;

alter table public.product_aliases alter column canonical_product_id set not null;
alter table public.product_aliases alter column platform set not null;
alter table public.product_aliases alter column match_method set default 'EXACT_SOURCE_ID';
alter table public.product_aliases alter column match_method set not null;
alter table public.product_aliases alter column manually_reviewed set default false;
alter table public.product_aliases alter column manually_reviewed set not null;
alter table public.product_aliases alter column updated_at set default now();
alter table public.product_aliases alter column updated_at set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='product_aliases_canonical_product_id_fkey' and conrelid='public.product_aliases'::regclass) then
    alter table public.product_aliases add constraint product_aliases_canonical_product_id_fkey
      foreign key (canonical_product_id) references public.canonical_products(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='product_aliases_match_method_check' and conrelid='public.product_aliases'::regclass) then
    alter table public.product_aliases add constraint product_aliases_match_method_check
      check (match_method in ('EXACT_SOURCE_ID','MANUAL_REVIEW','MIGRATED_LEGACY'));
  end if;
end $$;

create unique index if not exists product_aliases_platform_external_id_uidx on public.product_aliases(platform,external_id);
create index if not exists product_aliases_canonical_product_idx on public.product_aliases(canonical_product_id);
create index if not exists product_aliases_title_fingerprint_idx on public.product_aliases(title_fingerprint) where title_fingerprint is not null;

-- Decision-critical operational tables gain optional canonical UUID bindings.
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

-- Canonical identity is server-controlled infrastructure: authenticated read, no browser writes.
alter table public.canonical_products enable row level security;
alter table public.product_aliases enable row level security;

drop policy if exists canonical_products_authenticated_read on public.canonical_products;
create policy canonical_products_authenticated_read on public.canonical_products for select to authenticated using (true);

drop policy if exists product_aliases_authenticated_read on public.product_aliases;
create policy product_aliases_authenticated_read on public.product_aliases for select to authenticated using (true);

revoke insert,update,delete on public.canonical_products from anon,authenticated;
revoke insert,update,delete on public.product_aliases from anon,authenticated;
