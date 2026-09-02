-- Free-beta source policy.
-- Payment-triggering and unapproved automated sources are disabled by default.
-- The rights registry is internal service-owned control-plane data.

begin;

create table if not exists public.source_rights_registry_v2 (
  source_key text primary key,
  profile_version text not null default '2.0',
  status text not null,
  analysis_allowed boolean not null default false,
  commercial_use_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  derivatives_allowed boolean not null default false,
  image_rights text not null default 'UNKNOWN',
  cache_ttl_seconds bigint,
  license text,
  basis text not null,
  reviewed_at timestamptz,
  reviewer text,
  evidence_ref text,
  terms_snapshot_hash text,
  robots_snapshot_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.source_rights_registry_v2 enable row level security;
revoke all privileges on table public.source_rights_registry_v2 from public, anon, authenticated;
grant select, insert, update, delete on table public.source_rights_registry_v2 to service_role;

comment on table public.source_rights_registry_v2 is
'Internal fail-closed source-rights registry. Browser roles are intentionally denied; service-role pipelines only.';

insert into public.source_rights_registry_v2
(source_key, profile_version, status, analysis_allowed, commercial_use_allowed,
 redistribution_allowed, derivatives_allowed, image_rights, cache_ttl_seconds,
 license, basis, reviewed_at, reviewer, evidence_ref)
values
('KAGGLE_AMAZON_PRODUCTS_2023','2.0','COMMERCIAL_ALLOWED',true,true,true,true,'NOT_INCLUDED',null,'ODC-By-1.0',
 'DATABASE FACTS ONLY; ATTRIBUTION REQUIRED; PRODUCT IMAGES, DESCRIPTIONS AND TRADEMARK CONTENT EXCLUDED UNLESS SEPARATELY LICENSED',
 '2026-09-02T00:00:00Z','MPR_ZERO_COST_PUBLIC_LICENSE_REVIEW',
 'https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products'),
('THE_MARKUP_AMAZON_SEARCHES_2021','2.0','COMMERCIAL_ALLOWED',true,true,true,true,'NOT_INCLUDED',null,'BSD-3-Clause',
 'PINNED HISTORICAL RESEARCH DATASET; LICENSE NOTICE REQUIRED; NEVER PRESENT AS CURRENT MARKET OR VERIFIED SALES',
 '2026-09-02T00:00:00Z','MPR_ZERO_COST_PUBLIC_LICENSE_REVIEW',
 'https://github.com/the-markup/investigation-amazon-brands'),
('YOUTUBE_DATA_API','2.0','ANALYSIS_ALLOWED',true,false,false,true,'NOT_INCLUDED',null,'YOUTUBE_API_SERVICES_TERMS',
 'OFFICIAL API PILOT ONLY; COMMERCIAL DISPLAY, CACHING AND DELETION REQUIRE FINAL TERMS CHECK AND API CREDENTIALS',
 '2026-09-02T00:00:00Z','MPR_ZERO_COST_API_PRECHECK',
 'https://developers.google.com/youtube/v3/getting-started'),
('MANUAL_PUBLIC_FACT_CHECK','2.0','ANALYSIS_ALLOWED',true,false,false,true,'NOT_INCLUDED',null,null,
 'LIMITED HUMAN REVIEW OF MINIMAL FACTS AND SOURCE URL; NO SYSTEMATIC EXTRACTION OR COPYING OF PROTECTED CONTENT',
 '2026-09-02T00:00:00Z','MPR_ZERO_COST_MANUAL_RESEARCH_POLICY',
 'docs/ZERO_COST_BETA_OPERATING_PLAN_V1.md')
on conflict (source_key) do update set
  profile_version=excluded.profile_version,
  status=excluded.status,
  analysis_allowed=excluded.analysis_allowed,
  commercial_use_allowed=excluded.commercial_use_allowed,
  redistribution_allowed=excluded.redistribution_allowed,
  derivatives_allowed=excluded.derivatives_allowed,
  image_rights=excluded.image_rights,
  cache_ttl_seconds=excluded.cache_ttl_seconds,
  license=excluded.license,
  basis=excluded.basis,
  reviewed_at=excluded.reviewed_at,
  reviewer=excluded.reviewer,
  evidence_ref=excluded.evidence_ref,
  updated_at=now();

do $block$
begin
  if to_regclass('public.data_sources') is not null then
    update public.data_sources
    set enabled=false,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'free_beta_blocked',true,
          'free_beta_block_reason',case
            when paid then 'PAID_SOURCE_DISABLED_DURING_FREE_BETA'
            else 'RIGHTS_NOT_CONFIRMED_FOR_AUTOMATED_COLLECTION'
          end,
          'free_beta_blocked_at','2026-09-02T00:00:00Z'
        ),
        updated_at=now()
    where source_key in (
      'dataforseo_google_ads_ro',
      'dataforseo_merchant',
      'amazon_live_public_page_v1',
      'brightdata_amazon_public_sample'
    );
  end if;
end
$block$;

commit;
