create table if not exists public.launch_readiness_checks (
  check_code text primary key,
  status text not null default 'BLOCKED' check (status in ('BLOCKED','IN_REVIEW','PASS')),
  evidence_note text,
  verified_by uuid,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.launch_readiness_checks enable row level security;
-- No browser policies. This checklist is internal/admin only and is read/written through a service-role endpoint.
