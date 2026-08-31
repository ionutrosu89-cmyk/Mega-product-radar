-- Require the deployment-bound billing E2E acceptance ledger in paid-beta DB readiness.
-- The return signature gains one column, so Postgres requires a transactional drop/recreate.
begin;

drop function if exists public.mpr_billing_runtime_readiness();

create function public.mpr_billing_runtime_readiness()
returns table(
  ready boolean,
  subscriptions_table boolean,
  webhook_events_table boolean,
  ordering_created_column boolean,
  ordering_event_id_column boolean,
  webhook_status_column boolean,
  webhook_error_column boolean,
  atomic_apply_rpc boolean,
  billing_e2e_acceptance_table boolean
)
language sql
stable
security invoker
set search_path=pg_catalog,public
as $$
  select
    (
      pg_catalog.to_regclass('public.subscriptions') is not null
      and pg_catalog.to_regclass('public.billing_webhook_events') is not null
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='last_stripe_event_created')
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='last_stripe_event_id')
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='billing_webhook_events' and column_name='status')
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='billing_webhook_events' and column_name='last_error')
      and pg_catalog.to_regprocedure('public.apply_stripe_subscription_event(uuid,text,text,text,text,timestamp with time zone,boolean,bigint,text)') is not null
      and pg_catalog.to_regclass('public.billing_e2e_acceptance_runs') is not null
    ) as ready,
    pg_catalog.to_regclass('public.subscriptions') is not null as subscriptions_table,
    pg_catalog.to_regclass('public.billing_webhook_events') is not null as webhook_events_table,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='last_stripe_event_created') as ordering_created_column,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='last_stripe_event_id') as ordering_event_id_column,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='billing_webhook_events' and column_name='status') as webhook_status_column,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='billing_webhook_events' and column_name='last_error') as webhook_error_column,
    pg_catalog.to_regprocedure('public.apply_stripe_subscription_event(uuid,text,text,text,text,timestamp with time zone,boolean,bigint,text)') is not null as atomic_apply_rpc,
    pg_catalog.to_regclass('public.billing_e2e_acceptance_runs') is not null as billing_e2e_acceptance_table;
$$;

revoke execute on function public.mpr_billing_runtime_readiness() from public,anon,authenticated;
grant execute on function public.mpr_billing_runtime_readiness() to service_role;

commit;
