create table if not exists public.current_top25_snapshots_v1 (
  id uuid primary key default gen_random_uuid(),
  niche_id text not null,
  platform text not null,
  market text not null,
  window_days integer not null check (window_days in (7,30)),
  window_end timestamptz not null,
  products jsonb not null default '[]'::jsonb check (jsonb_typeof(products)='array'),
  product_count integer not null check (product_count between 0 and 25),
  evidence_class text not null check (evidence_class in ('DIRECT','DERIVED','ESTIMATED','INSUFFICIENT_DATA')),
  source_key text not null,
  source_label text not null,
  source_rights_status text not null default 'REVIEW_REQUIRED',
  freshness_status text not null default 'CURRENT' check (freshness_status in ('CURRENT','STALE','INSUFFICIENT_DATA','RIGHTS_HOLD')),
  created_at timestamptz not null default now(),
  unique(niche_id,platform,market,window_days,window_end),
  check (product_count = jsonb_array_length(products))
);

alter table public.current_top25_snapshots_v1 enable row level security;
revoke all on public.current_top25_snapshots_v1 from public, anon, authenticated;
grant all on public.current_top25_snapshots_v1 to service_role;

create index if not exists current_top25_lookup_v1 on public.current_top25_snapshots_v1 (niche_id,window_days,window_end desc);
create index if not exists current_top25_platform_v1 on public.current_top25_snapshots_v1 (platform,market,window_days,window_end desc);

comment on table public.current_top25_snapshots_v1 is 'Current 7D/30D Top25 evidence only. Historical archive data must not be stored here.';
comment on column public.current_top25_snapshots_v1.products is 'Each product must retain observedAt/source/evidence metadata; no historical fallback.';
