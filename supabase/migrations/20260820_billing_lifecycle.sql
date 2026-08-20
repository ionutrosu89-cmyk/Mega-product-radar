-- Stripe billing lifecycle hardening
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists subscriptions_provider_subscription_idx
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;
