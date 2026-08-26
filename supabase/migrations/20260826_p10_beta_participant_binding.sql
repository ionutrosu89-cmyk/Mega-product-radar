alter table public.beta_participants
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create unique index if not exists beta_participants_user_unique_idx
  on public.beta_participants(user_id)
  where user_id is not null;

create index if not exists beta_participants_workspace_idx
  on public.beta_participants(workspace_id)
  where workspace_id is not null;

-- P10 truth rule: participant linkage is admin/service-role managed only.
-- Do not add browser write policies to the closed-beta registry.
revoke all on table public.beta_participants from anon, authenticated;
