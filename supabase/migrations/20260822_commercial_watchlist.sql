create table if not exists public.commercial_watchlist (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  product_key text not null,
  product_name text not null,
  category text,
  state text not null default 'WATCHING' check (state in ('WATCHING','VALIDATING','TESTING','PAUSED')),
  notes text,
  baseline_action text,
  baseline_readiness numeric,
  baseline_score numeric,
  baseline_landed_confirmed boolean,
  baseline_passed_gates integer,
  last_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, product_key)
);

create index if not exists commercial_watchlist_workspace_updated_idx
  on public.commercial_watchlist(workspace_id, updated_at desc);

alter table public.commercial_watchlist enable row level security;

drop policy if exists commercial_watchlist_workspace_select on public.commercial_watchlist;
create policy commercial_watchlist_workspace_select
on public.commercial_watchlist for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = commercial_watchlist.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists commercial_watchlist_workspace_insert on public.commercial_watchlist;
create policy commercial_watchlist_workspace_insert
on public.commercial_watchlist for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = commercial_watchlist.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists commercial_watchlist_workspace_update on public.commercial_watchlist;
create policy commercial_watchlist_workspace_update
on public.commercial_watchlist for update
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = commercial_watchlist.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = commercial_watchlist.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists commercial_watchlist_workspace_delete on public.commercial_watchlist;
create policy commercial_watchlist_workspace_delete
on public.commercial_watchlist for delete
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = commercial_watchlist.workspace_id
      and wm.user_id = auth.uid()
  )
);
