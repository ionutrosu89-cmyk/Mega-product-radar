create table if not exists public.seller_preferences (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  experience_level text not null default 'BEGINNER' check (experience_level in ('BEGINNER','SELLER','ADVANCED')),
  monthly_budget_ron numeric not null default 3000 check (monthly_budget_ron >= 0),
  categories text[] not null default '{}'::text[],
  marketplaces text[] not null default '{}'::text[],
  sourcing_preference text not null default 'CHINA' check (sourcing_preference in ('CHINA','EU','ANY')),
  risk_profile text not null default 'BALANCED' check (risk_profile in ('CONSERVATIVE','BALANCED','AGGRESSIVE')),
  goal text not null default 'FIND_PRODUCTS' check (goal in ('FIND_PRODUCTS','GROW_EXISTING','START_BUSINESS')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_preferences enable row level security;

drop policy if exists "seller_preferences_member" on public.seller_preferences;
create policy "seller_preferences_member" on public.seller_preferences
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
