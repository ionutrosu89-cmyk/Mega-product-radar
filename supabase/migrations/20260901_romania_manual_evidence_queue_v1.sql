-- MPR Romania Manual Evidence Queue V1
-- Prioritizes products that have passed trend/importability but still lack comparable Romania evidence.
-- This view does not infer absence and does not create marketplace evidence.

create or replace view public.romania_manual_evidence_queue_v1 as
with comparable as (
  select product_id,
         bool_or(surface='EMAG_RO' and observed_at>=now()-interval '90 days' and coalesce(comparability_confidence,0)>=0.70) as has_emag,
         bool_or(surface='TRENDYOL_RO' and observed_at>=now()-interval '90 days' and coalesce(comparability_confidence,0)>=0.70) as has_trendyol,
         bool_or(surface='RO_RETAIL_WEB' and observed_at>=now()-interval '90 days' and coalesce(comparability_confidence,0)>=0.70) as has_retail_web,
         count(distinct surface) filter(where observed_at>=now()-interval '90 days' and coalesce(comparability_confidence,0)>=0.70) as comparable_surfaces,
         max(comparability_confidence) filter(where observed_at>=now()-interval '90 days') as max_comparability_confidence,
         max(observed_at) filter(where observed_at>=now()-interval '90 days') as latest_romania_observed_at
  from public.romania_surface_observations
  group by product_id
)
select o.product_id,o.canonical_key,o.title,o.brand,o.category,
       o.decision_stage,o.next_required_evidence,o.review_delta,
       coalesce(c.comparable_surfaces,0) as comparable_surfaces,
       coalesce(c.has_emag,false) as has_emag,
       coalesce(c.has_trendyol,false) as has_trendyol,
       coalesce(c.has_retail_web,false) as has_retail_web,
       c.max_comparability_confidence,c.latest_romania_observed_at,
       case
         when coalesce(c.comparable_surfaces,0)=0 then array['RO_RETAIL_WEB','TRENDYOL_RO']::text[]
         when coalesce(c.has_retail_web,false)=false then array['RO_RETAIL_WEB']::text[]
         when coalesce(c.has_trendyol,false)=false then array['TRENDYOL_RO']::text[]
         when coalesce(c.has_emag,false)=false then array['EMAG_RO']::text[]
         else array[]::text[] end as suggested_surfaces,
       case
         when o.decision_stage='VALIDATE_ROMANIA_GAP' then 100
         when coalesce(c.comparable_surfaces,0)=1 then 95
         when o.decision_stage='PROMISING_NEEDS_ROMANIA' then 90
         else 0 end as evidence_priority,
       false as absence_proven,
       false as market_wide_competition_ready,
       false as verified_sales
from public.opportunity_decision_v1 o
left join comparable c on c.product_id=o.product_id
where o.decision_stage in ('PROMISING_NEEDS_ROMANIA','VALIDATE_ROMANIA_GAP')
order by evidence_priority desc,coalesce(o.review_delta,0) desc,o.canonical_key;

revoke all on public.romania_manual_evidence_queue_v1 from anon, authenticated;
comment on view public.romania_manual_evidence_queue_v1 is 'Auditable manual/public Romania evidence work queue. Missing evidence never means absence; suggested surfaces are collection targets only.';
