-- P0 security foundation: audit events, Stripe webhook idempotency, and rate-limit events.
-- Service-role only operational tables; browser roles receive no direct privileges.

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid,
  event_type text not null,
  actor_role text,
  request_id text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_audit_events_workspace_created_idx on public.security_audit_events(workspace_id, created_at desc);
create index if not exists security_audit_events_type_created_idx on public.security_audit_events(event_type, created_at desc);
alter table public.security_audit_events enable row level security;
revoke all on public.security_audit_events from anon, authenticated;

create table if not exists public.billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'PROCESSING' check (status in ('PROCESSING','PROCESSED','FAILED')),
  last_error text
);
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from anon, authenticated;

create table if not exists public.api_rate_limit_events (
  id bigserial primary key,
  bucket_key text not null,
  route text not null,
  created_at timestamptz not null default now()
);
create index if not exists api_rate_limit_events_bucket_created_idx on public.api_rate_limit_events(bucket_key, created_at desc);
create index if not exists api_rate_limit_events_created_idx on public.api_rate_limit_events(created_at);
alter table public.api_rate_limit_events enable row level security;
revoke all on public.api_rate_limit_events from anon, authenticated;

-- Cleanup is intentionally explicit and can be scheduled externally; rate-limit rows need only a short retention.
