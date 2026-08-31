create table if not exists public.billing_e2e_acceptance_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'SANDBOX' check (environment in ('SANDBOX')),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','GO','NO_GO')),
  evidence jsonb not null,
  verdict jsonb,
  checkpoint_count integer not null default 0 check (checkpoint_count between 0 and 6),
  version bigint not null default 1 check (version > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(environment,workspace_id)
);

alter table public.billing_e2e_acceptance_runs enable row level security;

revoke all on table public.billing_e2e_acceptance_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_e2e_acceptance_runs to service_role;

comment on table public.billing_e2e_acceptance_runs is 'Server-owned Stripe sandbox billing journey acceptance ledger. Browser roles have no direct access.';
