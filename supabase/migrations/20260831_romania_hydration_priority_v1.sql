-- Prioritize R4 Romania hydration without triggering provider calls.
-- UNKNOWN stays UNKNOWN; this view only orders work already represented in the benchmark.

create or replace view public.romania_hydration_priority_v1 as
select
  m.product_id,
  m.selection_rank,
  m.top_category,
  m.observed_price,
  m.review_count,
  m.rating,
  c.coverage_class,
  c.surfaces_with_current_evidence,
  c.max_comparability_confidence,
  coalesce(a.verdict,'UNREVIEWED') as audit_verdict,
  case
    when a.id is not null then 'REVIEWED'
    when c.surfaces_with_current_evidence >= 2 then 'REVIEW_READY'
    when c.surfaces_with_current_evidence = 1 then 'NEED_SECOND_SURFACE'
    else 'NEED_FIRST_SURFACE'
  end as hydration_stage,
  (
    case
      when a.id is not null then 0
      when c.surfaces_with_current_evidence >= 2 then 1000
      when c.surfaces_with_current_evidence = 1 then 800
      else 500
    end
    + least(coalesce(m.review_count,0),10000)/100.0
    + coalesce(m.rating,0)*10
    - m.selection_rank/10.0
  )::numeric(12,2) as information_value_score,
  false as paid_calls_authorized,
  false as purchase_authorized,
  false as finalist_authorized
from public.romania_benchmark_membership m
join public.romania_evidence_coverage_v1 c on c.product_id=m.product_id
left join public.romania_gap_human_audit a
  on a.benchmark_version='R4' and a.product_id=m.product_id
where m.benchmark_version='R4' and m.status='ACTIVE';

revoke all on public.romania_hydration_priority_v1 from anon, authenticated;

create or replace view public.romania_hydration_progress_v1 as
select
  count(*) as benchmark_products,
  count(*) filter(where hydration_stage='REVIEWED') as reviewed,
  count(*) filter(where hydration_stage='REVIEW_READY') as review_ready,
  count(*) filter(where hydration_stage='NEED_SECOND_SURFACE') as need_second_surface,
  count(*) filter(where hydration_stage='NEED_FIRST_SURFACE') as need_first_surface,
  count(*) filter(where coverage_class='UNKNOWN') as unknown_products,
  count(*) filter(where audit_verdict='FALSE_POSITIVE') as false_positive_products,
  round(100.0*count(*) filter(where hydration_stage='REVIEWED')/nullif(count(*),0),2) as reviewed_pct
from public.romania_hydration_priority_v1;

revoke all on public.romania_hydration_progress_v1 from anon, authenticated;
