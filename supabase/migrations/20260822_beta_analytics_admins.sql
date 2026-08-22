create table if not exists public.beta_analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.beta_analytics_admins enable row level security;

-- No client policies by design. This registry is read only by trusted server-side
-- code using the Supabase service role. It must never be exposed through a
-- browser-side cross-workspace query.
revoke all on table public.beta_analytics_admins from anon, authenticated;
