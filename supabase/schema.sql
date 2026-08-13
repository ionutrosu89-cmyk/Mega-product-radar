-- Mega Product Radar 7.0 SaaS Foundation
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'STARTER' check (plan in ('STARTER','PRO','BUSINESS')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER','ADMIN','MEMBER')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, category text, source text, status text, score numeric, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.discovery_candidates (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, stage text, score numeric, quality text, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_name text not null, supplier_name text, platform text, url text, verified boolean not null default false, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.supplier_offers (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_name text not null, supplier_name text, platform text, url text, quoted_price numeric, moq numeric, rating numeric, years numeric, sample_cost numeric,
  trade_assurance boolean not null default false, certifications jsonb not null default '[]'::jsonb, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.landed_costs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_name text not null, landed_per_unit numeric, confirmed boolean not null default false, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_name text not null, status text, quantity numeric, capital numeric, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_name text not null, stock numeric, sales_30d numeric, revenue_30d numeric, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_name text not null, predicted_score numeric, actual_margin numeric, return_rate numeric, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  provider text not null default 'STRIPE', provider_customer_id text, provider_subscription_id text,
  plan text not null default 'STARTER', status text not null default 'FOUNDATION', current_period_end timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.usage_events (
  id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null, units integer not null default 1, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(wid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.workspace_members m where m.workspace_id=wid and m.user_id=auth.uid());
$$;

create or replace function public.create_personal_workspace(workspace_name text, workspace_slug text)
returns public.workspaces language plpgsql security definer set search_path=public as $$
declare w public.workspaces;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workspaces(name,slug,owner_id) values(workspace_name, workspace_slug || '-' || substr(auth.uid()::text,1,8), auth.uid()) returning * into w;
  insert into public.workspace_members(workspace_id,user_id,role) values(w.id,auth.uid(),'OWNER');
  insert into public.subscriptions(workspace_id,plan,status) values(w.id,'STARTER','FOUNDATION');
  return w;
end;$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.products enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.landed_costs enable row level security;
alter table public.purchases enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.feedback_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy "profile_self" on public.profiles for all using (id=auth.uid()) with check (id=auth.uid());
create policy "workspace_member_read" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspace_owner_update" on public.workspaces for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "members_workspace_read" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "products_member" on public.products for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "discovery_member" on public.discovery_candidates for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "suppliers_member" on public.suppliers for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "supplier_offers_member" on public.supplier_offers for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "landed_member" on public.landed_costs for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "purchases_member" on public.purchases for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "portfolio_member" on public.portfolio_items for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "feedback_member" on public.feedback_events for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "subscription_member_read" on public.subscriptions for select using (public.is_workspace_member(workspace_id));
create policy "usage_member_read" on public.usage_events for select using (public.is_workspace_member(workspace_id));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email) values(new.id,new.email) on conflict (id) do nothing; return new; end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

revoke execute on function public.create_personal_workspace(text,text) from public, anon;
revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.create_personal_workspace(text,text) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
