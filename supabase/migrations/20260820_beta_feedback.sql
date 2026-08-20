create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  rating integer check (rating between 1 and 5),
  area text not null default 'GENERAL',
  message text not null,
  would_pay boolean,
  requested_feature text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_workspace_created_idx on public.beta_feedback(workspace_id, created_at desc);
create index if not exists beta_feedback_area_created_idx on public.beta_feedback(area, created_at desc);

alter table public.beta_feedback enable row level security;

drop policy if exists "beta_feedback_select_own_workspace" on public.beta_feedback;
create policy "beta_feedback_select_own_workspace" on public.beta_feedback
for select using (
  exists(select 1 from public.workspace_members wm where wm.workspace_id = beta_feedback.workspace_id and wm.user_id = auth.uid())
);

drop policy if exists "beta_feedback_insert_own_workspace" on public.beta_feedback;
create policy "beta_feedback_insert_own_workspace" on public.beta_feedback
for insert with check (
  user_id = auth.uid() and exists(select 1 from public.workspace_members wm where wm.workspace_id = beta_feedback.workspace_id and wm.user_id = auth.uid())
);
