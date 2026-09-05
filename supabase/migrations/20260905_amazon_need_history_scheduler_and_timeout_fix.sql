create or replace function public.amazon_need_history_targets_v1(p_limit integer default 25)
returns table(product_id uuid, external_id text, canonical_key text, existing_observation_count bigint)
language sql
security definer
set search_path to 'public'
as $function$
  select
    pa.canonical_product_id as product_id,
    upper(pa.external_id) as external_id,
    cp.canonical_key,
    coalesce(o.n,0)::bigint as existing_observation_count
  from public.product_aliases pa
  join public.canonical_products cp on cp.id=pa.canonical_product_id
  left join lateral (
    select count(*)::bigint as n
    from (
      select 1
      from public.product_observations po
      where po.product_id=pa.canonical_product_id
      limit 2
    ) z
  ) o on true
  where pa.platform='AMAZON'
    and pa.match_method='EXACT_SOURCE_ID'
    and upper(pa.external_id) ~ '^[A-Z0-9]{10}$'
    and coalesce(o.n,0) <= 1
  order by
    coalesce(cp.priority_score,0) desc,
    case when upper(pa.external_id) like 'B%' and nullif(btrim(cp.title),'') is not null then 0 else 1 end,
    coalesce(o.n,0) asc,
    upper(pa.external_id) asc
  limit greatest(1,least(coalesce(p_limit,25),250));
$function$;

comment on function public.amazon_need_history_targets_v1(integer) is
'Returns exact-ASIN Amazon products with <=1 observations, prioritized by persisted canonical priority_score. Avoids recomputing the heavyweight intelligence_priority_queue_v1 view inside scheduled OIDC collection.';
