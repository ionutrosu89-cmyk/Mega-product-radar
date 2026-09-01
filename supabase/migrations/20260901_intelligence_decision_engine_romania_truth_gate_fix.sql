-- Keep the intelligence decision engine behind the canonical Romania truth gate.
-- Issue #215 requires exact, direct, manually reviewed eMAG + Trendyol evidence before economics.
-- This migration is deliberately stricter than V1: sampled/multi-surface evidence and a positive
-- human gap audit alone cannot advance a product to economics.

create or replace view public.romania_gap_signal_v1 as
with ro as (
  select product_id,
         count(distinct surface) as surfaces_any,
         count(distinct surface) filter(where observed_at>=now()-interval '90 days') as surfaces_current,
         max(comparability_confidence) as max_comparability_confidence,
         (
           count(distinct surface) filter(
             where observed_at>=now()-interval '90 days'
               and market_wide_competition_ready is true
               and comparable_scope_confirmed is true
           ) >= 2
         ) as market_wide_competition_ready,
         max(observed_at) as latest_ro_observed_at
  from public.romania_surface_observations
  group by product_id
), audit as (
  select distinct on(product_id) product_id,verdict as human_verdict,confidence as human_confidence,reviewed_at
  from public.romania_gap_human_audit
  order by product_id,reviewed_at desc,id desc
)
select p.id as product_id,
       coalesce(r.surfaces_any,0) as surfaces_any,
       coalesce(r.surfaces_current,0) as surfaces_current,
       r.max_comparability_confidence,r.market_wide_competition_ready,r.latest_ro_observed_at,
       a.human_verdict,a.human_confidence,a.reviewed_at,
       case
         when a.human_verdict is not null then 'HUMAN_'||a.human_verdict
         when coalesce(r.surfaces_current,0)>=2 and coalesce(r.max_comparability_confidence,0)>=0.70 then 'LOCAL_PRESENCE_CONFIRMED'
         when coalesce(r.surfaces_current,0)=1 then 'PARTIAL_LOCAL_EVIDENCE'
         else 'UNKNOWN' end as romania_gap_class,
       case
         when a.human_verdict in ('HIGH_GAP','MEDIUM_GAP') then true
         else false end as positive_gap_human_verified,
       case
         when a.human_verdict is not null then 'HUMAN_AUDIT'
         when coalesce(r.surfaces_current,0)>=2 then 'MULTI_SURFACE_COMPARABLE_EVIDENCE_NOT_MARKET_WIDE'
         when coalesce(r.surfaces_current,0)=1 then 'SINGLE_SURFACE_ONLY'
         else 'NO_CURRENT_ROMANIA_EVIDENCE' end as romania_gap_evidence_class
from public.canonical_products p
left join ro r on r.product_id=p.id
left join audit a on a.product_id=p.id;

create or replace view public.economics_readiness_v1 as
with q as (
 select product_id,
        count(*) as supplier_quote_count,
        count(*) filter(where unit_price is not null and moq is not null) as usable_supplier_quote_count,
        max(confidence) as supplier_quote_confidence
 from public.supplier_quotes group by product_id
), ro_price as (
 select product_id,
        count(*) filter(
          where (raw_evidence ? 'priceRon' or raw_evidence ? 'observedPriceRon')
            and market_wide_competition_ready is true
            and comparable_scope_confirmed is true
            and observed_at>=now()-interval '90 days'
        ) as local_price_evidence_count
 from public.romania_surface_observations group by product_id
)
select p.id as product_id,
       coalesce(q.supplier_quote_count,0) as supplier_quote_count,
       coalesce(q.usable_supplier_quote_count,0) as usable_supplier_quote_count,
       q.supplier_quote_confidence,
       coalesce(r.local_price_evidence_count,0) as local_price_evidence_count,
       case
         when coalesce(r.local_price_evidence_count,0)=0 then 'UNKNOWN_ROMANIA_SELL_PRICE'
         when coalesce(q.usable_supplier_quote_count,0)=0 then 'UNKNOWN_SUPPLIER_COST'
         else 'READY_FOR_CONSERVATIVE_ECONOMICS' end as economics_readiness,
       false as verified_profit
from public.canonical_products p
left join q on q.product_id=p.id
left join ro_price r on r.product_id=p.id;

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
         when c.commercial_filter_status<>'PASS' then 'DISCOVERED'
         when t.trend_class='UNKNOWN' then 'DISCOVERED'
         when rg.romania_gap_class='UNKNOWN' then 'PROMISING_NEEDS_ROMANIA'
         when coalesce(rg.market_wide_competition_ready,false)=false then 'VALIDATE_ROMANIA_GAP'
         when rg.positive_gap_human_verified=false then 'VALIDATE_ROMANIA_GAP'
         when e.local_price_evidence_count=0 then 'VALIDATE_ROMANIA_GAP'
         when e.economics_readiness<>'READY_FOR_CONSERVATIVE_ECONOMICS' then 'VALIDATE_ECONOMICS'
         else 'FINALIST_REVIEW_REQUIRED' end as decision_stage,
       case
         when c.commercial_filter_status='REJECT' then 'COMMERCIAL_FILTER_HARD_REJECT'
         when i.importability_class='REJECT_RISK' then 'IMPORTABILITY_HARD_REJECT'
         when t.trend_class='UNKNOWN' then 'NEED_LONGITUDINAL_TREND_EVIDENCE'
         when rg.romania_gap_class='UNKNOWN' then 'NEED_ROMANIA_EVIDENCE'
         when coalesce(rg.market_wide_competition_ready,false)=false then 'NEED_EXACT_MARKET_WIDE_ROMANIA_GAP'
         when rg.positive_gap_human_verified=false then 'NEED_POSITIVE_HUMAN_ROMANIA_GAP_AUDIT'
         when e.local_price_evidence_count=0 then 'NEED_EXACT_COMPARABLE_ROMANIA_SELL_PRICE'
         when e.economics_readiness='UNKNOWN_SUPPLIER_COST' then 'NEED_VERIFIED_SUPPLIER_QUOTE'
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

comment on view public.opportunity_decision_v1 is 'Truth-first MPR decision funnel. Exact MARKET_WIDE Romania evidence and exact comparable Romania sell-price evidence are mandatory before economics; FINALIST_REVIEW_REQUIRED is not FINALIST authorization.';
