-- Deterministic 1K Romania scale cohort from the exact Bright Data Amazon sample.
-- This is identity/evidence membership only; it does not claim Romania hydration.

create or replace view public.romania_scale_1000_membership_v1 as
with sample as (
  select distinct po.product_id
  from public.product_observations po
  where po.source_key='brightdata_amazon_public_sample'
), metrics as (
  select po.product_id,
    max(po.numeric_value) filter(where po.observation_type='marketplace_listing_price') as observed_price,
    max(po.numeric_value) filter(where po.observation_type='rating') as rating,
    max(po.numeric_value) filter(where po.observation_type='review_count') as review_count,
    count(*) as historical_observation_count
  from public.product_observations po
  join sample s on s.product_id=po.product_id
  group by po.product_id
), ro as (
  select o.product_id,
    count(distinct o.surface) as surfaces_with_any_evidence,
    count(distinct o.surface) filter(where o.freshness_class not in ('UNKNOWN','HISTORICAL_BOOTSTRAP_NOT_LIVE') and o.freshness_class not like 'INDEXED_STALE%') as surfaces_with_current_evidence,
    max(o.comparability_confidence) as max_comparability_confidence
  from public.romania_surface_observations o
  left join public.romania_observation_quality_review q on q.observation_id=o.id
  where coalesce(q.verdict,'ACCEPTED')<>'REJECTED'
  group by o.product_id
)
select
  row_number() over(order by cp.canonical_key)::integer as scale_rank,
  cp.id as product_id,
  cp.canonical_key,
  cp.title,
  cp.brand,
  coalesce(cp.category,cp.canonical_category,'UNKNOWN_CATEGORY') as category,
  metrics.observed_price,
  metrics.rating,
  metrics.review_count,
  metrics.historical_observation_count,
  coalesce(ro.surfaces_with_any_evidence,0) as romania_surfaces_any,
  coalesce(ro.surfaces_with_current_evidence,0) as romania_surfaces_current,
  ro.max_comparability_confidence,
  case
    when coalesce(ro.surfaces_with_current_evidence,0)>=2 then 'REVIEW_CANDIDATE'
    when coalesce(ro.surfaces_with_current_evidence,0)=1 then 'NEED_SECOND_SURFACE'
    else 'NEED_FIRST_SURFACE'
  end as hydration_stage,
  false as paid_calls_authorized,
  false as purchase_authorized,
  false as finalist_authorized
from sample s
join public.canonical_products cp on cp.id=s.product_id
join metrics on metrics.product_id=s.product_id
left join ro on ro.product_id=s.product_id;

revoke all on public.romania_scale_1000_membership_v1 from anon, authenticated;

create or replace view public.romania_scale_1000_progress_v1 as
select
  count(*) as cohort_products,
  count(*) filter(where category<>'UNKNOWN_CATEGORY') as category_known,
  count(*) filter(where observed_price is not null) as price_known,
  count(*) filter(where rating is not null) as rating_known,
  count(*) filter(where review_count is not null) as review_count_known,
  count(*) filter(where historical_observation_count>=2) as historical_2plus,
  count(*) filter(where historical_observation_count>=3) as historical_3plus,
  count(*) filter(where romania_surfaces_current>=1) as romania_current_1plus,
  count(*) filter(where romania_surfaces_current>=2) as romania_current_2plus,
  count(*) filter(where hydration_stage='NEED_FIRST_SURFACE') as need_first_surface,
  count(*) filter(where hydration_stage='NEED_SECOND_SURFACE') as need_second_surface,
  count(*) filter(where hydration_stage='REVIEW_CANDIDATE') as review_candidates
from public.romania_scale_1000_membership_v1;

revoke all on public.romania_scale_1000_progress_v1 from anon, authenticated;
