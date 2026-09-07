create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_google_trends_ro_collector_v1()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'mpr_google_trends_ro_cron_token'
  order by updated_at desc
  limit 1;
  if coalesce(v_token,'') = '' then raise exception 'GOOGLE_TRENDS_CRON_TOKEN_MISSING'; end if;
  select net.http_post(
    url := 'https://xqzsbebbuovcyeyxdqxo.supabase.co/functions/v1/google-trends-ro-collector-v1',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object('Authorization','Bearer ' || v_token,'Content-Type','application/json'),
    timeout_milliseconds := 20000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.invoke_google_trends_ro_collector_v1() from public, anon, authenticated;
grant execute on function private.invoke_google_trends_ro_collector_v1() to postgres;

create or replace function private.invoke_amazon_current_refresh_collector_v1()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'mpr_amazon_current_refresh_cron_token'
  order by updated_at desc
  limit 1;
  if coalesce(v_token,'') = '' then raise exception 'AMAZON_CURRENT_REFRESH_CRON_TOKEN_MISSING'; end if;
  select net.http_post(
    url := 'https://xqzsbebbuovcyeyxdqxo.supabase.co/functions/v1/amazon-current-refresh-collector-v1',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object('Authorization','Bearer ' || v_token,'Content-Type','application/json'),
    timeout_milliseconds := 120000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.invoke_amazon_current_refresh_collector_v1() from public, anon, authenticated;
grant execute on function private.invoke_amazon_current_refresh_collector_v1() to postgres;

do $$ declare r record; begin
  for r in select jobid from cron.job where jobname='mpr_google_trends_ro_hourly' loop perform cron.unschedule(r.jobid); end loop;
  for r in select jobid from cron.job where jobname='mpr_amazon_current_refresh_6h' loop perform cron.unschedule(r.jobid); end loop;
end $$;

select cron.schedule('mpr_google_trends_ro_hourly','7 * * * *','select private.invoke_google_trends_ro_collector_v1();');
select cron.schedule('mpr_amazon_current_refresh_6h','23 */6 * * *','select private.invoke_amazon_current_refresh_collector_v1();');

-- The raw cron tokens are intentionally NOT stored in git. Provision them in Supabase Vault under:
--   mpr_google_trends_ro_cron_token
--   mpr_amazon_current_refresh_cron_token
