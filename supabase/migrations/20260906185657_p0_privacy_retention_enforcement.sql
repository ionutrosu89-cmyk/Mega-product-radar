-- Enforce retention periods declared in privacy.html.
create or replace function private.enforce_privacy_retention_v1()
returns table(deleted_free_demand bigint, deleted_usage bigint, deleted_feedback bigint, deleted_journey bigint, deleted_beta_feedback bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  n_free bigint := 0;
  n_usage bigint := 0;
  n_feedback bigint := 0;
  n_journey bigint := 0;
  n_beta_feedback bigint := 0;
begin
  delete from public.free_demand_events where occurred_at < now() - interval '90 days';
  get diagnostics n_free = row_count;
  delete from public.usage_events where created_at < now() - interval '12 months';
  get diagnostics n_usage = row_count;
  delete from public.feedback_events where created_at < now() - interval '12 months';
  get diagnostics n_feedback = row_count;
  delete from public.journey_events where created_at < now() - interval '12 months';
  get diagnostics n_journey = row_count;
  delete from public.beta_feedback where created_at < now() - interval '12 months';
  get diagnostics n_beta_feedback = row_count;
  return query select n_free,n_usage,n_feedback,n_journey,n_beta_feedback;
end;
$$;

revoke all on function private.enforce_privacy_retention_v1() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='mpr_privacy_retention_daily' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'mpr_privacy_retention_daily',
  '17 3 * * *',
  $$select private.enforce_privacy_retention_v1();$$
);
