create index if not exists canonical_products_priority_score_idx
on public.canonical_products (priority_score desc, id);

create or replace function public.amazon_need_history_targets_v1(p_limit integer default 25)
returns table(product_id uuid, external_id text, canonical_key text, existing_observation_count bigint)
language sql
security definer
set search_path to 'public'
as $function$
  with prioritized as (
    select id, canonical_key, title, priority_score
    from public.canonical_products
    order by priority_score desc, id
    limit 5000
  )
  select
    pa.canonical_product_id as product_id,
    upper(pa.external_id) as external_id,
    p.canonical_key,
    coalesce(o.n,0)::bigint as existing_observation_count
  from prioritized p
  join public.product_aliases pa on pa.canonical_product_id=p.id
  left join lateral (
    select count(*)::bigint as n
    from (
      select 1
      from public.product_observations po
      where po.product_id=p.id
      limit 2
    ) z
  ) o on true
  where pa.platform='AMAZON'
    and pa.match_method='EXACT_SOURCE_ID'
    and upper(pa.external_id) ~ '^[A-Z0-9]{10}$'
    and coalesce(o.n,0) <= 1
  order by
    p.priority_score desc,
    case when upper(pa.external_id) like 'B%' and nullif(btrim(p.title),'') is not null then 0 else 1 end,
    coalesce(o.n,0) asc,
    upper(pa.external_id) asc
  limit greatest(1,least(coalesce(p_limit,25),250));
$function$;

comment on function public.amazon_need_history_targets_v1(integer) is
'Returns exact-ASIN Amazon products with <=1 observations from the top 5,000 persisted canonical priority scores. Bounded scan prevents scheduled PostgREST statement timeouts.';
