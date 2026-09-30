begin;

-- Intervention Watch needs a membership predicate in RLS, but the public
-- SECURITY DEFINER membership helper must not remain callable as an RPC.
drop policy if exists intervention_events_v1_read on public.intervention_events_v1;
create policy intervention_events_v1_read on public.intervention_events_v1
  for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists intervention_actions_v1_read on public.intervention_actions_v1;
create policy intervention_actions_v1_read on public.intervention_actions_v1
  for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists intervention_watch_snapshots_v1_read on public.intervention_watch_snapshots_v1;
create policy intervention_watch_snapshots_v1_read on public.intervention_watch_snapshots_v1
  for select to authenticated using (private.is_workspace_member(workspace_id));

drop policy if exists intervention_watch_runs_v1_read on public.intervention_watch_runs_v1;
create policy intervention_watch_runs_v1_read on public.intervention_watch_runs_v1
  for select to authenticated using (private.is_workspace_member(workspace_id));

revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to service_role;

commit;
