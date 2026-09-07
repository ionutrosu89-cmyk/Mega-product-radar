create or replace function public.amazon_current_refresh_targets_v1(p_limit integer default 100)
returns table(
  product_id uuid,
  external_id text,
  canonical_key text,
  live_observation_count bigint,
  last_live_observed_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with live as (
    select
      po.product_id,
      count(distinct po.observed_at)::bigint as live_observation_count,
      max(po.observed_at) as last_live_observed_at
    from public.product_observations po
    where po.source_key='amazon_live_public_page_v1'
      and po.observation_type in ('marketplace_listing_price','rating','review_count')
    group by po.product_id
  )
  select
    cp.id as product_id,
    upper(pa.external_id) as external_id,
    cp.canonical_key,
    live.live_observation_count,
    live.last_live_observed_at
  from live
  join public.canonical_products cp on cp.id=live.product_id
  join public.product_aliases pa on pa.canonical_product_id=cp.id
  where pa.platform='AMAZON'
    and pa.match_method='EXACT_SOURCE_ID'
    and upper(pa.external_id) ~ '^[A-Z0-9]{10}$'
    and live.last_live_observed_at <= now() - interval '20 hours'
  order by
    live.last_live_observed_at asc,
    cp.priority_score desc nulls last,
    upper(pa.external_id)
  limit greatest(1,least(coalesce(p_limit,100),250));
$$;

revoke all on function public.amazon_current_refresh_targets_v1(integer) from public, anon, authenticated;
grant execute on function public.amazon_current_refresh_targets_v1(integer) to service_role, postgres;
