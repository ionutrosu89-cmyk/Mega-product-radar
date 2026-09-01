-- MPR Intelligence-driven data routing V1
-- Uses the truth-first intelligence queue to prioritize zero-cost evidence collection.
-- No paid provider calls, supplier contact, purchase authority, or verified-sales claims.

create or replace function public.amazon_need_history_targets_v1(p_limit integer default 25)
returns table(product_id uuid, external_id text, canonical_key text, existing_observation_count bigint)
language sql
security definer
set search_path to 'public'
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
      coalesce(o.n,0)::bigint as existing_observation_count,
      coalesce(iq.information_priority,0) as information_priority,
      iq.workstream
    from public.product_aliases pa
    join public.canonical_products cp on cp.id=pa.canonical_product_id
    left join obs o on o.product_id=pa.canonical_product_id
    left join public.intelligence_priority_queue_v1 iq on iq.product_id=pa.canonical_product_id
    where pa.platform='AMAZON'
      and pa.match_method='EXACT_SOURCE_ID'
      and upper(pa.external_id) ~ '^[A-Z0-9]{10}$'
      and coalesce(o.n,0) <= 1
  )
  select c.product_id,c.external_id,c.canonical_key,c.existing_observation_count
  from candidates c
  order by
    case when c.workstream='TREND_HISTORY' then 0 else 1 end,
    c.information_priority desc,
    case when c.external_id like 'B%' and nullif(btrim(c.title),'') is not null then 0 else 1 end,
    c.existing_observation_count asc,
    c.external_id asc
  limit greatest(1,least(coalesce(p_limit,25),250));
$function$;

-- Bring intelligence-qualified Romania candidates to the front on currently usable zero-cost surfaces.
update public.refresh_queue q
set priority_score = greatest(coalesce(q.priority_score,0), 1000),
    due_at = least(q.due_at, now()),
    reason = case
      when q.reason like 'INTELLIGENCE_PRIORITY_%' then q.reason
      else 'INTELLIGENCE_PRIORITY_ROMANIA_V1'
    end
where q.state='PENDING'
  and q.evidence_kind='ROMANIA_MARKET_EVIDENCE'
  and q.target_surface in ('TRENDYOL_RO','RO_RETAIL_WEB')
  and q.provider_policy->>'benchmark_status'='ACTIVE'
  and coalesce(q.estimated_cost_eur,0)=0
  and coalesce((q.provider_policy->>'paid_calls_allowed')::boolean,false)=false
  and coalesce((q.provider_policy->>'purchase_authorized')::boolean,false)=false
  and exists (
    select 1
    from public.intelligence_priority_queue_v1 iq
    where iq.product_id=q.product_id
      and iq.workstream in ('ROMANIA_FIRST_SURFACE','ROMANIA_SECOND_SURFACE_OR_AUDIT')
  );

comment on function public.amazon_need_history_targets_v1(integer) is
  'Returns zero/one-history exact Amazon identities, prioritizing the MPR intelligence TREND_HISTORY workstream. No provider spend or purchase authority.';
