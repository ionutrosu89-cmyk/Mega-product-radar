create table if not exists public.viral_discovery_sources_v1 (
  id bigserial primary key,
  source_key text not null unique,
  platform text not null check (platform in ('TIKTOK','META','GOOGLE_TRENDS','GOOGLE_SHOPPING','AMAZON','YOUTUBE','PINTEREST','REDDIT','OTHER')),
  access_mode text not null check (access_mode in ('OFFICIAL_API','PUBLIC_EXPORT','PUBLIC_PAGE','MANUAL_EVIDENCE')),
  terms_review_status text not null default 'REVIEW_REQUIRED' check (terms_review_status in ('APPROVED','REVIEW_REQUIRED','BLOCKED')),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.viral_product_concepts_v1 (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  concept_name text not null,
  category text,
  generic_search_terms text[] not null default '{}',
  detected_brand text,
  brand_policy_class text not null default 'UNKNOWN_REVIEW' check (brand_policy_class in ('ESTABLISHED_EXCLUDE','SMALL_BRAND_ALLOWED','GENERIC_PRIVATE_LABEL','UNKNOWN_REVIEW')),
  status text not null default 'DISCOVERED' check (status in ('DISCOVERED','WATCH','ROMANIA_VALIDATION','COMMERCIAL_VALIDATION','STOPPED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.viral_observations_v1 (
  id bigserial primary key,
  concept_id uuid not null references public.viral_product_concepts_v1(id) on delete cascade,
  source_id bigint not null references public.viral_discovery_sources_v1(id),
  external_id text not null,
  country_code text not null,
  observed_at timestamptz not null,
  source_url text not null,
  title text,
  view_count bigint,
  engagement_count bigint,
  active_ad_count integer,
  search_interest numeric,
  marketplace_rank integer,
  review_count integer,
  evidence_class text not null check (evidence_class in ('DIRECT','DERIVED','MANUAL','UNVERIFIED')),
  raw_payload jsonb not null default '{}',
  collected_at timestamptz not null default now(),
  unique(source_id,external_id,country_code,observed_at)
);

create table if not exists public.viral_candidate_scores_v1 (
  concept_id uuid primary key references public.viral_product_concepts_v1(id) on delete cascade,
  computed_at timestamptz not null default now(),
  observation_count integer not null,
  platform_count integer not null,
  foreign_country_count integer not null,
  tiktok_velocity_score numeric,
  meta_ad_momentum_score numeric,
  google_acceleration_score numeric,
  amazon_demand_score numeric,
  romania_scarcity_score numeric,
  viral_score numeric,
  lifecycle text not null check (lifecycle in ('UNVERIFIED','WATCH','EARLY','ACCELERATING','VIRAL','MATURE','DECLINING')),
  romania_evidence_class text not null default 'UNVERIFIED' check (romania_evidence_class in ('UNVERIFIED','SAMPLED','VALIDATED')),
  importability_pass boolean,
  supplier_verified boolean,
  economics_confirmed boolean,
  score_inputs jsonb not null default '{}'
);

alter table public.viral_discovery_sources_v1 enable row level security;
alter table public.viral_product_concepts_v1 enable row level security;
alter table public.viral_observations_v1 enable row level security;
alter table public.viral_candidate_scores_v1 enable row level security;

drop policy if exists viral_sources_service_role_all on public.viral_discovery_sources_v1;
create policy viral_sources_service_role_all on public.viral_discovery_sources_v1 for all to service_role using (true) with check (true);
drop policy if exists viral_concepts_service_role_all on public.viral_product_concepts_v1;
create policy viral_concepts_service_role_all on public.viral_product_concepts_v1 for all to service_role using (true) with check (true);
drop policy if exists viral_observations_service_role_all on public.viral_observations_v1;
create policy viral_observations_service_role_all on public.viral_observations_v1 for all to service_role using (true) with check (true);
drop policy if exists viral_scores_service_role_all on public.viral_candidate_scores_v1;
create policy viral_scores_service_role_all on public.viral_candidate_scores_v1 for all to service_role using (true) with check (true);

create index if not exists viral_observations_concept_time_idx on public.viral_observations_v1(concept_id,observed_at desc);
create index if not exists viral_observations_country_time_idx on public.viral_observations_v1(country_code,observed_at desc);

create or replace view public.viral_abroad_missing_romania_queue_v1 as
select
  c.id as concept_id,c.concept_name,c.category,c.brand_policy_class,c.status,
  s.viral_score,s.lifecycle,s.observation_count,s.platform_count,s.foreign_country_count,
  s.romania_scarcity_score,s.romania_evidence_class,
  case
    when c.brand_policy_class='ESTABLISHED_EXCLUDE' then 'STOP_BRAND_GATE'
    when s.observation_count<2 or s.platform_count<2 then 'COLLECT_CROSS_PLATFORM_HISTORY'
    when s.lifecycle in ('ACCELERATING','VIRAL') and s.foreign_country_count>=2 and s.romania_evidence_class='UNVERIFIED' then 'VALIDATE_ROMANIA_GAP'
    when s.romania_evidence_class='SAMPLED' then 'STRENGTHEN_ROMANIA_EVIDENCE'
    when s.romania_evidence_class='VALIDATED' and s.importability_pass is distinct from true then 'REVIEW_IMPORTABILITY'
    when s.romania_evidence_class='VALIDATED' and s.importability_pass=true and s.supplier_verified is distinct from true then 'VALIDATE_3_SUPPLIERS'
    when s.supplier_verified=true and s.economics_confirmed is distinct from true then 'VALIDATE_ECONOMICS'
    when s.economics_confirmed=true then 'FINALIST_REVIEW'
    else 'WATCH'
  end as next_action,
  false as purchase_authorized
from public.viral_product_concepts_v1 c
join public.viral_candidate_scores_v1 s on s.concept_id=c.id
where c.brand_policy_class<>'ESTABLISHED_EXCLUDE';

comment on view public.viral_abroad_missing_romania_queue_v1 is
'Truth-first queue for generic/small-brand products accelerating abroad and not yet validated in Romania. Viral score never bypasses brand, Romania, importability, supplier or economics gates.';

insert into public.viral_discovery_sources_v1(source_key,platform,access_mode,terms_review_status,enabled) values
('TIKTOK_CREATIVE_CENTER','TIKTOK','PUBLIC_PAGE','REVIEW_REQUIRED',false),
('META_AD_LIBRARY','META','PUBLIC_PAGE','REVIEW_REQUIRED',false),
('GOOGLE_TRENDS','GOOGLE_TRENDS','PUBLIC_PAGE','REVIEW_REQUIRED',false),
('GOOGLE_SHOPPING_POPULAR_PRODUCTS','GOOGLE_SHOPPING','PUBLIC_EXPORT','REVIEW_REQUIRED',false),
('AMAZON_MARKET_SIGNAL','AMAZON','PUBLIC_PAGE','REVIEW_REQUIRED',false),
('YOUTUBE_TRENDS','YOUTUBE','OFFICIAL_API','REVIEW_REQUIRED',false),
('PINTEREST_TRENDS','PINTEREST','PUBLIC_PAGE','REVIEW_REQUIRED',false),
('REDDIT_PRODUCT_SIGNALS','REDDIT','OFFICIAL_API','REVIEW_REQUIRED',false)
on conflict (source_key) do nothing;
