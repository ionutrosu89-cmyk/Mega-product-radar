create table if not exists public.journey_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  event_name text not null,
  plan text not null default 'FREE',
  page text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists journey_events_workspace_created_idx on public.journey_events(workspace_id, created_at desc);
create index if not exists journey_events_name_created_idx on public.journey_events(event_name, created_at desc);

alter table public.journey_events enable row level security;

drop policy if exists "journey_events_select_own_workspace" on public.journey_events;
create policy "journey_events_select_own_workspace" on public.journey_events
for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id = journey_events.workspace_id and wm.user_id = auth.uid())
);

drop policy if exists "journey_events_insert_own_workspace" on public.journey_events;
create policy "journey_events_insert_own_workspace" on public.journey_events
for insert with check (
  user_id = auth.uid() and exists(select 1 from public.workspace_members wm where wm.workspace_id = journey_events.workspace_id and wm.user_id = auth.uid())
);
