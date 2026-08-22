create table if not exists public.top25_snapshots (
  id uuid primary key default gen_random_uuid(),
  niche_id text not null,
  reviewed_at date not null,
  products jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (niche_id, reviewed_at)
);

create index if not exists top25_snapshots_niche_reviewed_idx
  on public.top25_snapshots (niche_id, reviewed_at desc);

alter table public.top25_snapshots enable row level security;

-- Central Top 25 history is written and read through a server-side Netlify function
-- using the Supabase service role. No browser/anon policies are intentionally granted.
