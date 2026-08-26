-- Compatibility preflight for environments where Data Platform V3 already created
-- canonical_products/product_aliases using the legacy column names.
-- This runs before 20260826_canonical_product_identity_v1.sql and is additive only.

alter table if exists public.canonical_products add column if not exists canonical_name text;
alter table if exists public.canonical_products add column if not exists canonical_category text;
alter table if exists public.canonical_products add column if not exists identity_status text;

update public.canonical_products
set canonical_name = coalesce(canonical_name, title),
    canonical_category = coalesce(canonical_category, category),
    identity_status = coalesce(identity_status, case when status='ARCHIVED' then 'ARCHIVED' else 'ACTIVE' end)
where canonical_name is null or canonical_category is null or identity_status is null;

alter table public.canonical_products alter column identity_status set default 'ACTIVE';
alter table public.canonical_products alter column identity_status set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='canonical_products_identity_status_check' and conrelid='public.canonical_products'::regclass) then
    alter table public.canonical_products add constraint canonical_products_identity_status_check
      check (identity_status in ('ACTIVE','MERGED','REVIEW','ARCHIVED'));
  end if;
end $$;

alter table if exists public.product_aliases add column if not exists canonical_product_id uuid;
alter table if exists public.product_aliases add column if not exists platform text;
alter table if exists public.product_aliases add column if not exists market text;
alter table if exists public.product_aliases add column if not exists observed_title text;
alter table if exists public.product_aliases add column if not exists title_fingerprint text;
alter table if exists public.product_aliases add column if not exists source_url text;
alter table if exists public.product_aliases add column if not exists match_method text;
alter table if exists public.product_aliases add column if not exists manually_reviewed boolean;
alter table if exists public.product_aliases add column if not exists updated_at timestamptz;

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
