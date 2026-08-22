create table if not exists public.beta_participants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'INVITED' check (status in ('INVITED','ACTIVATED','COMPLETED','PAUSED')),
  notes text,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists beta_participants_status_idx on public.beta_participants(status);
alter table public.beta_participants enable row level security;
-- Intentionally no browser RLS policies: registry is service-role/admin only.
