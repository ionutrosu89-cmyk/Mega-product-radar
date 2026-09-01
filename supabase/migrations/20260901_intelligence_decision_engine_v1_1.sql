-- MPR Intelligence Decision Engine V1.1
-- Calibration from first live funnel: audited LOW_GAP/FALSE_POSITIVE and declining trend must not advance.

create or replace view public.opportunity_decision_v1 as
select c.product_id,c.canonical_key,c.title,c.brand,c.category,
       c.commercial_filter_status,c.commercial_filter_reasons,
       t.trend_class,t.trend_evidence_class,t.review_delta,
       rg.romania_gap_class,rg.romania_gap_evidence_class,rg.surfaces_current,rg.max_comparability_confidence,rg.positive_gap_human_verified,
       i.importability_class,i.importability_reason,
       e.economics_readiness,e.supplier_quote_count,e.local_price_evidence_count,
       case
         when c.commercial_filter_status='REJECT' then 'REJECTED'
         when i.importability_class='REJECT_RISK' then 'REJECTED'
         when rg.romania_gap_class='HUMAN_FALSE_POSITIVE' then 'REJECTED_MATCH'
         when rg.romania_gap_class='HUMAN_LOW_GAP' then 'REJECTED_LOW_GAP'
         when t.trend_class='CONFLICT_OR_DECLINE' then 'REJECTED_TREND'
         when c.commercial_filter_status<>'PASS' then 'DISCOVERED'
         when t.trend_class='UNKNOWN' then 'DISCOVERED'
         when t.trend_class='FLAT_LONGITUDINAL' then 'DISCOVERED'
         when rg.romania_gap_class='UNKNOWN' then 'PROMISING_NEEDS_ROMANIA'
         when rg.romania_gap_class='PARTIAL_LOCAL_EVIDENCE' then 'VALIDATE_ROMANIA_GAP'
         when rg.positive_gap_human_verified=false then 'VALIDATE_ROMANIA_GAP'
         when e.economics_readiness<>'READY_FOR_CONSERVATIVE_ECONOMICS' then 'VALIDATE_ECONOMICS'
         else 'FINALIST_REVIEW_REQUIRED' end as decision_stage,
       case
         when c.commercial_filter_status='REJECT' then 'COMMERCIAL_FILTER_HARD_REJECT'
         when i.importability_class='REJECT_RISK' then 'IMPORTABILITY_HARD_REJECT'
         when rg.romania_gap_class='HUMAN_FALSE_POSITIVE' then 'ROMANIA_MATCH_FALSE_POSITIVE_REJECTED'
         when rg.romania_gap_class='HUMAN_LOW_GAP' then 'ROMANIA_GAP_TOO_LOW'
         when t.trend_class='CONFLICT_OR_DECLINE' then 'TREND_CONFLICT_OR_DECLINE'
         when t.trend_class='UNKNOWN' then 'NEED_LONGITUDINAL_TREND_EVIDENCE'
         when t.trend_class='FLAT_LONGITUDINAL' then 'NEED_STRONGER_TREND_SIGNAL'
         when rg.romania_gap_class='UNKNOWN' then 'NEED_ROMANIA_EVIDENCE'
         when rg.romania_gap_class='PARTIAL_LOCAL_EVIDENCE' then 'NEED_SECOND_COMPARABLE_ROMANIA_SURFACE'
         when rg.positive_gap_human_verified=false then 'NEED_POSITIVE_HUMAN_ROMANIA_GAP_AUDIT'
         when e.economics_readiness='UNKNOWN_SUPPLIER_COST' then 'NEED_VERIFIED_SUPPLIER_QUOTE'
         when e.economics_readiness='UNKNOWN_ROMANIA_SELL_PRICE' then 'NEED_COMPARABLE_ROMANIA_PRICE'
         else 'HUMAN_FINALIST_REVIEW_REQUIRED' end as next_required_evidence,
       false as finalist_authorized,
       false as buy_ready,
       false as purchase_authorized,
       false as verified_sales
from public.commercial_filter_v1 c
join public.trend_signal_v1 t on t.product_id=c.product_id
join public.romania_gap_signal_v1 rg on rg.product_id=c.product_id
join public.importability_signal_v1 i on i.product_id=c.product_id
join public.economics_readiness_v1 e on e.product_id=c.product_id;

create or replace view public.intelligence_priority_queue_v1 as
select o.*,
       case
         when o.decision_stage='VALIDATE_ECONOMICS' then 100
         when o.decision_stage='VALIDATE_ROMANIA_GAP' then 90
         when o.decision_stage='PROMISING_NEEDS_ROMANIA' then 80
         when o.decision_stage='DISCOVERED' and o.commercial_filter_status='PASS' then 40
         else 0 end as information_priority,
       case
         when o.decision_stage='VALIDATE_ECONOMICS' then 'ECONOMICS'
         when o.decision_stage='VALIDATE_ROMANIA_GAP' then 'ROMANIA_SECOND_SURFACE_OR_AUDIT'
         when o.decision_stage='PROMISING_NEEDS_ROMANIA' then 'ROMANIA_FIRST_SURFACE'
         when o.decision_stage='DISCOVERED' and o.commercial_filter_status='PASS' then 'TREND_HISTORY'
         else 'NO_ACTION' end as workstream
from public.opportunity_decision_v1 o
where o.decision_stage not like 'REJECTED%'
order by information_priority desc,coalesce(o.review_delta,0) desc,o.canonical_key;

create or replace view public.intelligence_funnel_summary_v1 as
select decision_stage,count(*)::bigint as products
from public.opportunity_decision_v1
group by decision_stage
order by products desc;

comment on view public.intelligence_priority_queue_v1 is 'Information-value queue only. It does not authorize provider spend, supplier contact, FINALIST, BUY, or purchase.';
