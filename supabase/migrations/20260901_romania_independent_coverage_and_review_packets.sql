create or replace view public.importability_ai_review_assist_v1 as
select r.*,
  case
    when r.review_readiness <> 'READY_FOR_HUMAN_IMPORTABILITY_REVIEW' then 'COLLECT_MISSING_EVIDENCE'
    when r.importability_class = 'REVIEW_BRAND_VARIANT' then 'HUMAN_REVIEW_REQUIRED_BRAND_SOURCING'
    when r.importability_class = 'REVIEW_BULKY' and r.dimensions_records > 0 and r.weight_records > 0 then 'HUMAN_REVIEW_PRIORITY_PHYSICAL_SPECS_COMPLETE'
    when r.importability_class = 'REVIEW_FRAGILITY' and r.material_records > 0 and r.dimensions_records > 0 then 'HUMAN_REVIEW_PRIORITY_FRAGILITY_SPECS_COMPLETE'
    else 'HUMAN_REVIEW_REQUIRED'
  end as ai_review_assist,
  case
    when r.review_readiness <> 'READY_FOR_HUMAN_IMPORTABILITY_REVIEW' then false
    when r.importability_class = 'REVIEW_BRAND_VARIANT' then false
    else true
  end as eligible_for_priority_human_review
from public.importability_review_readiness_v1 r;

create or replace view public.romania_independent_surface_coverage_v1 as
with valid as (
  select o.product_id,o.id as observation_id,o.surface,
    case when o.surface='RO_RETAIL_WEB' and o.source_url is not null
      then 'RO_RETAIL_WEB:' || lower(regexp_replace(split_part(split_part(o.source_url,'://',2),'/',1),'^www\\.','','i'))
      else o.surface end as independent_surface_key,
    o.comparability_confidence,o.observed_at,o.source_url
  from public.romania_surface_observations o
  left join public.romania_observation_quality_review q on q.observation_id=o.id
  where coalesce(q.verdict,'ACCEPTED') <> 'REJECTED'
    and o.freshness_class is not null
    and o.freshness_class not in ('UNKNOWN','HISTORICAL_BOOTSTRAP_NOT_LIVE')
    and o.freshness_class not like 'INDEXED_STALE%'
)
select product_id,count(*) as current_observations,
  count(distinct surface) as legacy_surface_count,
  count(distinct independent_surface_key) as independent_surface_count,
  max(comparability_confidence) as max_comparability_confidence,
  max(observed_at) as last_observed_at,
  array_agg(distinct independent_surface_key order by independent_surface_key) as independent_surfaces
from valid group by product_id;

create or replace view public.romania_evidence_coverage_v1 as
with r4 as (
  select product_id,selection_rank,top_category
  from public.romania_benchmark_membership
  where benchmark_version='R4' and status='ACTIVE'
), valid_observations as (
  select o.*,
    case when o.surface='RO_RETAIL_WEB' and o.source_url is not null
      then 'RO_RETAIL_WEB:' || lower(regexp_replace(split_part(split_part(o.source_url,'://',2),'/',1),'^www\\.','','i'))
      else o.surface end as independent_surface_key
  from public.romania_surface_observations o
  left join public.romania_observation_quality_review q on q.observation_id=o.id
  where coalesce(q.verdict,'ACCEPTED') <> 'REJECTED'
), obs as (
  select o.product_id,o.independent_surface_key,count(*) observation_count,max(o.observed_at) last_observed_at,
    bool_or(o.freshness_class is not null and o.freshness_class not in ('UNKNOWN','HISTORICAL_BOOTSTRAP_NOT_LIVE') and o.freshness_class not like 'INDEXED_STALE%') has_current_evidence,
    bool_or(o.freshness_class like 'INDEXED_STALE%' or o.freshness_class='HISTORICAL_BOOTSTRAP_NOT_LIVE') has_stale_evidence,
    max(o.comparability_confidence) max_comparability_confidence
  from valid_observations o join r4 on r4.product_id=o.product_id
  group by o.product_id,o.independent_surface_key
), product_rollup as (
  select r4.product_id,r4.selection_rank,r4.top_category,
    count(distinct obs.independent_surface_key) filter(where obs.observation_count>0) surfaces_with_any_evidence,
    count(distinct obs.independent_surface_key) filter(where obs.has_current_evidence) surfaces_with_current_evidence,
    count(distinct obs.independent_surface_key) filter(where obs.has_stale_evidence and not obs.has_current_evidence) surfaces_stale_only,
    max(obs.last_observed_at) last_observed_at,max(obs.max_comparability_confidence) max_comparability_confidence
  from r4 left join obs on obs.product_id=r4.product_id
  group by r4.product_id,r4.selection_rank,r4.top_category
)
select product_id,selection_rank,top_category,surfaces_with_any_evidence,surfaces_with_current_evidence,surfaces_stale_only,last_observed_at,max_comparability_confidence,
  case when surfaces_with_current_evidence>=3 then 'CURRENT_3_SURFACES'
       when surfaces_with_current_evidence=2 then 'CURRENT_2_SURFACES'
       when surfaces_with_current_evidence=1 then 'CURRENT_1_SURFACE'
       when surfaces_with_any_evidence>0 then 'STALE_ONLY' else 'UNKNOWN' end coverage_class,
  surfaces_with_current_evidence>=2 and coalesce(max_comparability_confidence,0)>=0.70 eligible_for_human_romania_gap_review,
  false market_wide_competition_ready
from product_rollup;

drop view if exists public.golden_set_review_packet_v1;
create view public.golden_set_review_packet_v1 as
select b.product_id,b.selection_rank,b.top_category,b.observed_price,b.review_count,b.rating,b.selection_rule,
  coalesce(q.coverage_class,'UNKNOWN') coverage_class,coalesce(q.surfaces_with_current_evidence,0) surfaces_with_current_evidence,
  coalesce(i.independent_surface_count,0) independent_surface_count,i.independent_surfaces,q.max_comparability_confidence,q.last_observed_at,
  coalesce(q.reviewed,false) romania_gap_reviewed,q.verdict romania_gap_verdict,q.audit_confidence,q.reviewed_at romania_gap_reviewed_at,
  cp.title,cp.brand,cp.category,ir.importability_class,ir.review_readiness importability_review_readiness,ir.importability_approved,
  ir.ai_review_assist importability_ai_review_assist,
  case when coalesce(q.reviewed,false) is not true then 'REVIEW_ROMANIA_GAP'
       when ir.review_readiness='READY_FOR_HUMAN_IMPORTABILITY_REVIEW' and ir.importability_approved is not true then 'REVIEW_IMPORTABILITY'
       when q.verdict in ('FALSE_POSITIVE','REJECT') then 'STOP_FALSE_POSITIVE'
       else 'CONTINUE_EVIDENCE_VALIDATION' end next_human_action
from public.romania_benchmark_membership b
join public.canonical_products cp on cp.id=b.product_id
left join public.romania_gap_human_review_queue_v1 q on q.product_id=b.product_id
left join public.romania_independent_surface_coverage_v1 i on i.product_id=b.product_id
left join public.importability_ai_review_assist_v1 ir on ir.product_id=b.product_id
where b.benchmark_version='R4' and b.status='ACTIVE';