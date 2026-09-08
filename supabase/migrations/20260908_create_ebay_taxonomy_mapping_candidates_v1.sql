create table if not exists public.ebay_taxonomy_mapping_candidates_v1 (
  marketplace_id text not null,
  niche_id text not null,
  niche_label text not null,
  category_tree_id text not null,
  category_tree_version text,
  candidate_rank integer not null check (candidate_rank between 1 and 8),
  category_id text not null,
  category_name text not null,
  category_path jsonb not null default '[]'::jsonb,
  review_score integer not null check (review_score between 0 and 100),
  leaf boolean not null default false,
  review_state text not null default 'REVIEW_REQUIRED',
  activation_eligible boolean not null default false,
  evidence_class text not null default 'EBAY_CATEGORY_TREE_REVIEW_CANDIDATE',
  observed_at timestamptz not null default now(),
  primary key (marketplace_id,niche_id,candidate_rank)
);

alter table public.ebay_taxonomy_mapping_candidates_v1 enable row level security;
revoke all on table public.ebay_taxonomy_mapping_candidates_v1 from public, anon, authenticated;
grant select, insert, update, delete on table public.ebay_taxonomy_mapping_candidates_v1 to service_role;

create index if not exists ebay_taxonomy_mapping_candidates_v1_niche_idx on public.ebay_taxonomy_mapping_candidates_v1 (niche_id,marketplace_id);
create index if not exists ebay_taxonomy_mapping_candidates_v1_category_idx on public.ebay_taxonomy_mapping_candidates_v1 (marketplace_id,category_id);
