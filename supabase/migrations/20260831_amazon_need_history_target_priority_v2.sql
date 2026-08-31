-- Prioritize commercial B-prefixed Amazon ASINs with source title evidence for zero/one-history refresh.
-- Numeric/ISBN-style aliases remain fallback only; the <=1 observation gate is unchanged.

create or replace function public.amazon_need_history_targets_v1(p_limit integer default 25)
returns table(product_id uuid, external_id text, canonical_key text, existing_observation_count bigint)
language sql
security definer
set search_path=public
as $function$
  with obs as (
    select po.product_id, count(*)::bigint as n
    from public.product_observations po
    group by po.product_id
  ), candidates as (
    select
      pa.canonical_product_id as product_id,
      upper(pa.external_id) as external_id,
      cp.canonical_key,
      cp.title,
      coalesce(o.n,0)::bigint as existing_observation_count
    from public.product_aliases pa
    join public.canonical_products cp on cp.id=pa.canonical_product_id
    left join obs o on o.product_id=pa.canonical_product_id
    where pa.platform='AMAZON'
      and pa.match_method='EXACT_SOURCE_ID'
      and upper(pa.external_id) ~ '^[A-Z0-9]{10}$'
      and coalesce(o.n,0) <= 1
  )
  select c.product_id,c.external_id,c.canonical_key,c.existing_observation_count
  from candidates c
  order by
    case when c.external_id like 'B%' and nullif(btrim(c.title),'') is not null then 0 else 1 end,
    c.existing_observation_count asc,
    c.external_id asc
  limit greatest(1,least(coalesce(p_limit,25),250));
$function$;

revoke all on function public.amazon_need_history_targets_v1(integer) from public,anon,authenticated;
grant execute on function public.amazon_need_history_targets_v1(integer) to service_role;
