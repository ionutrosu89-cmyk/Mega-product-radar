begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_workspace_member(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = wid
      and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;

-- The public RPC no longer runs with postgres privileges. The insert path is
-- constrained by RLS and is idempotent for the user's first personal workspace.
create or replace function public.create_personal_workspace(workspace_name text, workspace_slug text)
returns public.workspaces
language plpgsql
security invoker
set search_path = ''
as $$
declare
  w public.workspaces;
  uid uuid := (select auth.uid());
  safe_name text := trim(workspace_name);
  safe_slug text := lower(trim(workspace_slug));
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if char_length(safe_name) not between 2 and 80 then raise exception 'Workspace name must have 2-80 characters'; end if;
  if safe_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(safe_slug) > 64 then raise exception 'Invalid workspace slug'; end if;

  select * into w from public.workspaces where owner_id=uid order by created_at limit 1;
  if found then return w; end if;

  insert into public.workspaces(name,slug,owner_id,plan)
  values(safe_name, safe_slug || '-' || substr(uid::text,1,8), uid, 'FREE')
  returning * into w;
  insert into public.workspace_members(workspace_id,user_id,role) values(w.id,uid,'OWNER');
  insert into public.subscriptions(workspace_id,plan,status) values(w.id,'FREE','FOUNDATION');
  return w;
end;
$$;
revoke all on function public.create_personal_workspace(text,text) from public, anon;
grant execute on function public.create_personal_workspace(text,text) to authenticated, service_role;

-- Keep the legacy helper unavailable over the public Data API. Policies below
-- use the equivalent helper from the non-exposed private schema.
revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to service_role;

drop policy if exists "profile_self" on public.profiles;
create policy "profile_self" on public.profiles for all to authenticated
using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists "workspace_member_read" on public.workspaces;
create policy "workspace_member_read" on public.workspaces for select to authenticated
using (owner_id=(select auth.uid()) or private.is_workspace_member(id));
drop policy if exists "workspace_owner_insert" on public.workspaces;
create policy "workspace_owner_insert" on public.workspaces for insert to authenticated
with check (owner_id=(select auth.uid()) and plan='FREE');
drop policy if exists "workspace_owner_update" on public.workspaces;
create policy "workspace_owner_update" on public.workspaces for update to authenticated
using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));

drop policy if exists "members_workspace_read" on public.workspace_members;
create policy "members_workspace_read" on public.workspace_members for select to authenticated
using (private.is_workspace_member(workspace_id));
drop policy if exists "workspace_owner_member_insert" on public.workspace_members;
create policy "workspace_owner_member_insert" on public.workspace_members for insert to authenticated
with check (
  user_id=(select auth.uid()) and role='OWNER' and exists (
    select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())
  )
);

drop policy if exists "subscription_member_read" on public.subscriptions;
create policy "subscription_member_read" on public.subscriptions for select to authenticated
using (private.is_workspace_member(workspace_id));
drop policy if exists "workspace_owner_subscription_insert" on public.subscriptions;
create policy "workspace_owner_subscription_insert" on public.subscriptions for insert to authenticated
with check (
  plan='FREE' and status='FOUNDATION' and exists (
    select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())
  )
);

drop policy if exists "commercial_outcomes_own" on public.commercial_outcomes;
create policy "commercial_outcomes_own" on public.commercial_outcomes for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

drop policy if exists "privacy_requests_own" on public.privacy_requests;
create policy "privacy_requests_own" on public.privacy_requests for all to authenticated
using (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id))
with check (user_id=(select auth.uid()) and private.is_workspace_member(workspace_id));

drop policy if exists "journey_events_select_own_workspace" on public.journey_events;
create policy "journey_events_select_own_workspace" on public.journey_events for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=journey_events.workspace_id and wm.user_id=(select auth.uid())));
drop policy if exists "journey_events_insert_own_workspace" on public.journey_events;
create policy "journey_events_insert_own_workspace" on public.journey_events for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.workspace_members wm where wm.workspace_id=journey_events.workspace_id and wm.user_id=(select auth.uid())));

drop policy if exists "beta_feedback_select_own_workspace" on public.beta_feedback;
create policy "beta_feedback_select_own_workspace" on public.beta_feedback for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=beta_feedback.workspace_id and wm.user_id=(select auth.uid())));
drop policy if exists "beta_feedback_insert_own_workspace" on public.beta_feedback;
create policy "beta_feedback_insert_own_workspace" on public.beta_feedback for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.workspace_members wm where wm.workspace_id=beta_feedback.workspace_id and wm.user_id=(select auth.uid())));

drop policy if exists "commercial_watchlist_workspace_select" on public.commercial_watchlist;
create policy "commercial_watchlist_workspace_select" on public.commercial_watchlist for select to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=commercial_watchlist.workspace_id and wm.user_id=(select auth.uid())));
drop policy if exists "commercial_watchlist_workspace_insert" on public.commercial_watchlist;
create policy "commercial_watchlist_workspace_insert" on public.commercial_watchlist for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.workspace_members wm where wm.workspace_id=commercial_watchlist.workspace_id and wm.user_id=(select auth.uid())));
drop policy if exists "commercial_watchlist_workspace_update" on public.commercial_watchlist;
create policy "commercial_watchlist_workspace_update" on public.commercial_watchlist for update to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=commercial_watchlist.workspace_id and wm.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists(select 1 from public.workspace_members wm where wm.workspace_id=commercial_watchlist.workspace_id and wm.user_id=(select auth.uid())));
drop policy if exists "commercial_watchlist_workspace_delete" on public.commercial_watchlist;
create policy "commercial_watchlist_workspace_delete" on public.commercial_watchlist for delete to authenticated
using (exists(select 1 from public.workspace_members wm where wm.workspace_id=commercial_watchlist.workspace_id and wm.user_id=(select auth.uid())));

-- Replace all remaining public helper references with the non-exposed helper.
drop policy if exists "commercial_observations_member" on public.commercial_observations;
create policy "commercial_observations_member" on public.commercial_observations for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "discovery_member" on public.discovery_candidates;
create policy "discovery_member" on public.discovery_candidates for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "feedback_member" on public.feedback_events;
create policy "feedback_member" on public.feedback_events for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "landed_member" on public.landed_costs;
create policy "landed_member" on public.landed_costs for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "portfolio_member" on public.portfolio_items;
create policy "portfolio_member" on public.portfolio_items for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "products_member" on public.products;
create policy "products_member" on public.products for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "purchases_member" on public.purchases;
create policy "purchases_member" on public.purchases for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "rfq_dispatch_member" on public.rfq_dispatch_states;
create policy "rfq_dispatch_member" on public.rfq_dispatch_states for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "seller_preferences_member" on public.seller_preferences;
create policy "seller_preferences_member" on public.seller_preferences for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "supplier_offers_member" on public.supplier_offers;
create policy "supplier_offers_member" on public.supplier_offers for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "suppliers_member" on public.suppliers;
create policy "suppliers_member" on public.suppliers for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "test_execution_member" on public.test_execution_records;
create policy "test_execution_member" on public.test_execution_records for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));
drop policy if exists "usage_member_read" on public.usage_events;
create policy "usage_member_read" on public.usage_events for select to authenticated using (private.is_workspace_member(workspace_id));

revoke all on public.workspaces, public.workspace_members, public.subscriptions from anon;
revoke all on public.workspaces, public.workspace_members, public.subscriptions from authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert on public.workspace_members to authenticated;
grant select, insert on public.subscriptions to authenticated;

create index if not exists workspace_members_user_id_idx on public.workspace_members(user_id);
create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);
create index if not exists products_workspace_id_idx on public.products(workspace_id);
create index if not exists discovery_candidates_workspace_id_idx on public.discovery_candidates(workspace_id);
create index if not exists feedback_events_workspace_id_idx on public.feedback_events(workspace_id);
create index if not exists landed_costs_workspace_id_idx on public.landed_costs(workspace_id);
create index if not exists portfolio_items_workspace_id_idx on public.portfolio_items(workspace_id);
create index if not exists purchases_workspace_id_idx on public.purchases(workspace_id);
create index if not exists supplier_offers_workspace_id_idx on public.supplier_offers(workspace_id);
create index if not exists suppliers_workspace_id_idx on public.suppliers(workspace_id);
create index if not exists usage_events_workspace_id_idx on public.usage_events(workspace_id);

commit;
