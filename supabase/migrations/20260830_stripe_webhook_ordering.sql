-- Prevent stale or same-second ambiguous Stripe lifecycle events from regressing entitlement.
alter table public.subscriptions
  add column if not exists last_stripe_event_created bigint not null default 0,
  add column if not exists last_stripe_event_id text;

create or replace function public.apply_stripe_subscription_event(
  p_workspace_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_plan text,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_stripe_event_created bigint,
  p_stripe_event_id text
) returns table(
  applied boolean,
  reason text,
  previous_plan text,
  previous_cancel_at_period_end boolean
)
language plpgsql
security invoker
set search_path=pg_catalog,public
as $$
declare
  current_row public.subscriptions%rowtype;
  incoming_plan text := upper(coalesce(p_plan,'FREE'));
  incoming_status text := lower(coalesce(p_status,'unknown'));
  current_paid boolean;
  incoming_paid boolean;
  current_rank integer;
  incoming_rank integer;
  equal_timestamp boolean := false;
begin
  if p_workspace_id is null or p_stripe_event_created is null or p_stripe_event_created <= 0 or coalesce(trim(p_stripe_event_id),'') = '' then
    raise exception 'Invalid Stripe lifecycle event ordering metadata';
  end if;
  if incoming_plan not in ('FREE','DISCOVER','RADAR','LAUNCH') then
    raise exception 'Invalid commercial plan';
  end if;

  insert into public.subscriptions(workspace_id,provider,plan,status)
  values(p_workspace_id,'STRIPE','FREE','FOUNDATION')
  on conflict (workspace_id) do nothing;

  select * into current_row
  from public.subscriptions
  where workspace_id=p_workspace_id
  for update;

  if current_row.last_stripe_event_created > p_stripe_event_created then
    return query select false,'STALE',current_row.plan,current_row.cancel_at_period_end;
    return;
  end if;

  equal_timestamp := current_row.last_stripe_event_created = p_stripe_event_created
    and current_row.last_stripe_event_id is not null
    and current_row.last_stripe_event_id <> p_stripe_event_id;

  if equal_timestamp then
    current_paid := lower(coalesce(current_row.status,'unknown')) in ('active','trialing')
      and upper(coalesce(current_row.plan,'FREE')) in ('DISCOVER','RADAR','LAUNCH');
    incoming_paid := incoming_status in ('active','trialing')
      and incoming_plan in ('DISCOVER','RADAR','LAUNCH');
    current_rank := case upper(coalesce(current_row.plan,'FREE')) when 'DISCOVER' then 1 when 'RADAR' then 2 when 'LAUNCH' then 3 else 0 end;
    incoming_rank := case incoming_plan when 'DISCOVER' then 1 when 'RADAR' then 2 when 'LAUNCH' then 3 else 0 end;

    if incoming_paid and not current_paid then
      return query select false,'AMBIGUOUS_WOULD_GRANT',current_row.plan,current_row.cancel_at_period_end;
      return;
    end if;
    if incoming_paid and current_paid and incoming_rank > current_rank then
      return query select false,'AMBIGUOUS_WOULD_UPGRADE',current_row.plan,current_row.cancel_at_period_end;
      return;
    end if;
  end if;

  update public.subscriptions set
    provider='STRIPE',
    provider_customer_id=p_provider_customer_id,
    provider_subscription_id=p_provider_subscription_id,
    plan=incoming_plan,
    status=p_status,
    current_period_end=p_current_period_end,
    cancel_at_period_end=coalesce(p_cancel_at_period_end,false),
    last_stripe_event_created=p_stripe_event_created,
    last_stripe_event_id=p_stripe_event_id,
    updated_at=now()
  where workspace_id=p_workspace_id;

  update public.workspaces
  set plan=incoming_plan,updated_at=now()
  where id=p_workspace_id;

  return query select true,
    case when equal_timestamp then 'AMBIGUOUS_FAIL_CLOSED' else 'APPLIED' end,
    current_row.plan,
    current_row.cancel_at_period_end;
end;
$$;

revoke execute on function public.apply_stripe_subscription_event(uuid,text,text,text,text,timestamptz,boolean,bigint,text) from public,anon,authenticated;
grant execute on function public.apply_stripe_subscription_event(uuid,text,text,text,text,timestamptz,boolean,bigint,text) to service_role;
