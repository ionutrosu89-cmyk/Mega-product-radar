create table if not exists public.current_search_signals_v1 (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  market text not null,
  window_days integer not null check (window_days in (1,7,30)),
  observed_at timestamptz not null,
  query_text text not null,
  normalized_query text not null,
  signal_type text not null check (signal_type in ('TRENDING_NOW','TOP_TERM','RISING_TERM')),
  rank integer check (rank is null or rank between 1 and 1000),
  search_volume_lower_bound bigint check (search_volume_lower_bound is null or search_volume_lower_bound >= 0),
  growth_percent numeric check (growth_percent is null or growth_percent >= 0),
  source_url text not null,
  evidence_class text not null default 'DIRECT' check (evidence_class in ('DIRECT','DERIVED','ESTIMATED','INSUFFICIENT_DATA')),
  rights_status text not null default 'APPROVED_OFFICIAL_PUBLIC_EXPORT',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_key,market,window_days,observed_at,normalized_query,signal_type)
);

alter table public.current_search_signals_v1 enable row level security;
revoke all on public.current_search_signals_v1 from public, anon, authenticated;
grant all on public.current_search_signals_v1 to service_role;
create index if not exists current_search_signals_recent_v1 on public.current_search_signals_v1 (market,window_days,observed_at desc);
create index if not exists current_search_signals_query_v1 on public.current_search_signals_v1 (normalized_query,observed_at desc);
comment on table public.current_search_signals_v1 is 'Current search-interest signals only; not verified product sales.';
