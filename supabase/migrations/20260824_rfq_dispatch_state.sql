create table if not exists public.rfq_dispatch_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_key text not null,
  product_name text not null,
  supplier_name text not null,
  platform text,
  status text not null default 'NOT_SENT' check (status in ('NOT_SENT','SENT','REPLIED','CLOSED')),
  sent_at timestamptz,
  sent_by text,
  channel text,
  response_received_at timestamptz,
  response_reference text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, product_key, supplier_name),
  constraint rfq_sent_truth check (
    (status = 'NOT_SENT' and sent_at is null and sent_by is null)
    or (status in ('SENT','REPLIED','CLOSED') and sent_at is not null and nullif(trim(sent_by),'') is not null and nullif(trim(channel),'') is not null)
  ),
  constraint rfq_reply_truth check (
    status not in ('REPLIED','CLOSED')
    or (response_received_at is not null and nullif(trim(response_reference),'') is not null)
  )
);

create index if not exists rfq_dispatch_states_workspace_product_idx
  on public.rfq_dispatch_states(workspace_id, product_key, status);

alter table public.rfq_dispatch_states enable row level security;

drop policy if exists rfq_dispatch_member on public.rfq_dispatch_states;
create policy rfq_dispatch_member
  on public.rfq_dispatch_states
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

comment on table public.rfq_dispatch_states is
  'Private workspace RFQ outreach state. NOT_SENT never implies outreach; SENT requires real dispatch metadata; REPLIED requires a real response reference.';
