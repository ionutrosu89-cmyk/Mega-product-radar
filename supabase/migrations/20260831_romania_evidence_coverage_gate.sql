-- Romania evidence coverage/freshness gate.
-- Stale/indexed/historical evidence remains visible but cannot be counted as current coverage.

create or replace view public.romania_evidence_coverage_v1 as
with r4 as (
  select product_id,selection_rank,top_category
  from public.romania_benchmark_membership
  where benchmark_version='R4' and status='ACTIVE'
), obs as (
  select o.product_id,o.surface,
         count(*) as observation_count,
         max(o.observed_at) as last_observed_at,
         bool_or(
           o.freshness_class is not null
           and o.freshness_class not in ('UNKNOWN','HISTORICAL_BOOTSTRAP_NOT_LIVE')
           and o.freshness_class not like 'INDEXED_STALE%'
         ) as has_current_evidence,
         bool_or(o.freshness_class like 'INDEXED_STALE%' or o.freshness_class='HISTORICAL_BOOTSTRAP_NOT_LIVE') as has_stale_evidence,
         max(o.comparability_confidence) as max_comparability_confidence
  from public.romania_surface_observations o
  join r4 on r4.product_id=o.product_id
  group by o.product_id,o.surface
), product_rollup as (
  select r4.product_id,r4.selection_rank,r4.top_category,
    count(distinct obs.surface) filter(where obs.observation_count>0) as surfaces_with_any_evidence,
    count(distinct obs.surface) filter(where obs.has_current_evidence) as surfaces_with_current_evidence,
    count(distinct obs.surface) filter(where obs.has_stale_evidence and not obs.has_current_evidence) as surfaces_stale_only,
    max(obs.last_observed_at) as last_observed_at,
    max(obs.max_comparability_confidence) as max_comparability_confidence
  from r4 left join obs on obs.product_id=r4.product_id
  group by r4.product_id,r4.selection_rank,r4.top_category
)
select *,
  case
    when surfaces_with_current_evidence>=3 then 'CURRENT_3_SURFACES'
    when surfaces_with_current_evidence=2 then 'CURRENT_2_SURFACES'
    when surfaces_with_current_evidence=1 then 'CURRENT_1_SURFACE'
    when surfaces_with_any_evidence>0 then 'STALE_ONLY'
    else 'UNKNOWN'
  end as coverage_class,
  (surfaces_with_current_evidence>=2 and coalesce(max_comparability_confidence,0)>=0.70) as eligible_for_human_romania_gap_review,
  false as market_wide_competition_ready
from product_rollup;

revoke all on public.romania_evidence_coverage_v1 from anon, authenticated;

create or replace view public.romania_evidence_coverage_summary_v1 as
select
  count(*) as benchmark_products,
  count(*) filter(where surfaces_with_any_evidence>0) as products_any_evidence,
  count(*) filter(where surfaces_with_current_evidence>0) as products_current_evidence,
  count(*) filter(where surfaces_with_current_evidence>=2) as products_current_2plus_surfaces,
  count(*) filter(where surfaces_with_current_evidence>=3) as products_current_3_surfaces,
  count(*) filter(where coverage_class='STALE_ONLY') as products_stale_only,
  count(*) filter(where coverage_class='UNKNOWN') as products_unknown,
  count(*) filter(where eligible_for_human_romania_gap_review) as products_human_review_eligible,
  round(100.0*count(*) filter(where surfaces_with_current_evidence>0)/nullif(count(*),0),2) as current_coverage_pct,
  round(100.0*count(*) filter(where coverage_class='UNKNOWN')/nullif(count(*),0),2) as unknown_pct
from public.romania_evidence_coverage_v1;

revoke all on public.romania_evidence_coverage_summary_v1 from anon, authenticated;
