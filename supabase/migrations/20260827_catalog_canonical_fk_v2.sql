begin;

-- Catalog V2 is anchored to the global canonical_products table, not the legacy workspace products table.
-- This migration intentionally fails if pre-existing rows cannot be rebound safely.

alter table public.product_identity_keys_v2
  drop constraint if exists product_identity_keys_v2_product_id_fkey;

alter table public.product_identity_keys_v2
  add constraint product_identity_keys_v2_product_id_fkey
  foreign key (product_id)
  references public.canonical_products(id)
  on delete cascade;

alter table public.catalog_source_records_v1
  drop constraint if exists catalog_source_records_v1_product_id_fkey;

alter table public.catalog_source_records_v1
  add constraint catalog_source_records_v1_product_id_fkey
  foreign key (product_id)
  references public.canonical_products(id)
  on delete set null;

alter table public.product_claims_v1
  drop constraint if exists product_claims_v1_product_id_fkey;

alter table public.product_claims_v1
  add constraint product_claims_v1_product_id_fkey
  foreign key (product_id)
  references public.canonical_products(id)
  on delete set null;

comment on table public.product_identity_keys_v2 is
  'Canonical identity keys for global canonical_products. Workspace scopes uniqueness and ingestion ownership; product_id references canonical_products.';
comment on table public.catalog_source_records_v1 is
  'Source-native catalogue records linked to global canonical_products when identity is resolved.';
comment on table public.product_claims_v1 is
  'Field-level catalogue claims linked to global canonical_products when identity is resolved.';

commit;
