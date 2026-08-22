create table if not exists public.top25_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  status text not null check (status in ('SUCCESS','PARTIAL','FAILED')),
  sources_checked integer not null default 0 check (sources_checked >= 0),
  sources_ok integer not null default 0 check (sources_ok >= 0),
  niches_changed integer not null default 0 check (niches_changed >= 0),
  details jsonb not null default '{}'::jsonb
);

create index if not exists top25_refresh_runs_checked_idx
  on public.top25_refresh_runs (checked_at desc);

alter table public.top25_refresh_runs enable row level security;

-- Refresh audit is server-only. No browser/anon policies are intentionally granted.
