alter view public.viral_abroad_missing_romania_queue_v1
  set (security_invoker = true);

alter view public.viral_romania_validation_queue_v1
  set (security_invoker = true);

revoke all on public.viral_abroad_missing_romania_queue_v1 from anon, authenticated;
revoke all on public.viral_romania_validation_queue_v1 from anon, authenticated;
grant select on public.viral_abroad_missing_romania_queue_v1 to service_role;
grant select on public.viral_romania_validation_queue_v1 to service_role;

drop policy if exists viral_romania_validation_targets_service_role_all
  on public.viral_romania_validation_targets_v1;

create policy viral_romania_validation_targets_service_role_all
  on public.viral_romania_validation_targets_v1
  for all
  to service_role
  using (true)
  with check (true);
