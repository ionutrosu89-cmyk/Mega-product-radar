begin;

-- Restore catalogue prerequisites present in the live schema but absent from the historical chain.
-- Read-only schema snapshot: 2026-09-19. No business rows are copied.

create table if not exists public.bulk_ingestion_runs_v1 (
  id uuid default gen_random_uuid() not null,
  source_key text not null,
  manifest_sha256 text not null,
  records_sha256 text not null,
  retrieved_at timestamp with time zone not null,
  input_count integer default 0 not null,
  accepted_count integer default 0 not null,
  held_count integer default 0 not null,
  logical_duplicate_count integer default 0 not null,
  silent_drop_count integer default 0 not null,
  checkpoint_sha256 text,
  decision text not null,
  provider_data_spend_eur numeric default 0 not null,
  paid_data_calls_triggered integer default 0 not null,
  purchase_authorized boolean default false not null,
  sales_evidence_class text default 'NOT_VERIFIED_SALES'::text not null,
  verified_sales_rows integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  constraint bulk_ingestion_runs_v1_paid_data_calls_triggered_check CHECK ((paid_data_calls_triggered = 0)),
  constraint bulk_ingestion_runs_v1_pkey PRIMARY KEY (id),
  constraint bulk_ingestion_runs_v1_provider_data_spend_eur_check CHECK ((provider_data_spend_eur = (0)::numeric)),
  constraint bulk_ingestion_runs_v1_purchase_authorized_check CHECK ((purchase_authorized = false)),
  constraint bulk_ingestion_runs_v1_sales_evidence_class_check CHECK ((sales_evidence_class = 'NOT_VERIFIED_SALES'::text)),
  constraint bulk_ingestion_runs_v1_source_key_manifest_sha256_key UNIQUE (source_key, manifest_sha256),
  constraint bulk_ingestion_runs_v1_verified_sales_rows_check CHECK ((verified_sales_rows = 0))
);
alter table public.bulk_ingestion_runs_v1 enable row level security;

create table if not exists public.catalog_source_records_v1 (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  source_key text not null,
  source_record_id text,
  observed_at timestamp with time zone,
  product_id uuid,
  evidence_class text default 'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'::text not null,
  rights_decision text not null,
  identity_strength text,
  raw_payload jsonb default '{}'::jsonb not null,
  content_sha256 text,
  created_at timestamp with time zone default now() not null,
  constraint catalog_source_records_v1_pkey PRIMARY KEY (id),
  constraint catalog_source_records_v1_product_id_fkey FOREIGN KEY (product_id) REFERENCES canonical_products(id) ON DELETE SET NULL,
  constraint catalog_source_records_v1_workspace_id_source_key_source_re_key UNIQUE (workspace_id, source_key, source_record_id)
);
alter table public.catalog_source_records_v1 enable row level security;
CREATE INDEX IF NOT EXISTS catalog_source_records_v1_product_idx ON public.catalog_source_records_v1 USING btree (product_id);
CREATE INDEX IF NOT EXISTS catalog_source_records_v1_source_idx ON public.catalog_source_records_v1 USING btree (workspace_id, source_key);

create table if not exists public.product_claims_v1 (
  id uuid default gen_random_uuid() not null,
  product_id uuid,
  source_key text not null,
  source_record_id text,
  field_name text not null,
  field_value jsonb not null,
  observed_at timestamp with time zone,
  rights_decision text default 'HOLD'::text not null,
  evidence_class text default 'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'::text not null,
  confidence numeric default 0 not null,
  claim_sha256 text not null,
  created_at timestamp with time zone default now() not null,
  constraint product_claims_v1_claim_sha256_key UNIQUE (claim_sha256),
  constraint product_claims_v1_pkey PRIMARY KEY (id),
  constraint product_claims_v1_product_id_fkey FOREIGN KEY (product_id) REFERENCES canonical_products(id) ON DELETE SET NULL
);
alter table public.product_claims_v1 enable row level security;
CREATE INDEX IF NOT EXISTS product_claims_v1_product_id_idx ON public.product_claims_v1 USING btree (product_id);
CREATE INDEX IF NOT EXISTS product_claims_v1_source_idx ON public.product_claims_v1 USING btree (source_key, source_record_id);

create table if not exists public.product_identity_keys_v2 (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  product_id uuid not null,
  namespace text not null,
  value_norm text not null,
  confidence numeric default 1 not null,
  source_key text,
  created_at timestamp with time zone default now() not null,
  constraint product_identity_keys_v2_pkey PRIMARY KEY (id),
  constraint product_identity_keys_v2_product_id_fkey FOREIGN KEY (product_id) REFERENCES canonical_products(id) ON DELETE CASCADE,
  constraint product_identity_keys_v2_workspace_id_namespace_value_norm_key UNIQUE (workspace_id, namespace, value_norm)
);
alter table public.product_identity_keys_v2 enable row level security;
CREATE INDEX IF NOT EXISTS product_identity_keys_v2_product_idx ON public.product_identity_keys_v2 USING btree (product_id);
CREATE INDEX IF NOT EXISTS product_identity_keys_v2_namespace_idx ON public.product_identity_keys_v2 USING btree (workspace_id, namespace);


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
