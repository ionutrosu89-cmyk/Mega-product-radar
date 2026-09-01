-- MPR Intelligence Decision Engine V1
-- Truth-first foundation: commercial filter -> trend -> Romania gap -> importability -> economics -> decision stage.
-- Scores never override hard gates. UNKNOWN is preserved.

create or replace view public.commercial_filter_v1 as
with obs as (
  select product_id,
         count(*)::bigint as observation_count,
         count(*) filter (where observation_type='price')::bigint as price_observations,
         count(*) filter (where observation_type='rating')::bigint as rating_observations,
         count(*) filter (where observation_type in ('review_count','reviews'))::bigint as review_observations,
         max(observed_at) as latest_observed_at
  from public.product_observations
  group by product_id
), base as (
  select p.*,
         lower(coalesce(p.title,'')) as t,
         lower(coalesce(p.category,'')) as c
  from public.canonical_products p
)
select b.id as product_id,b.canonical_key,b.title,b.brand,b.category,
       coalesce(o.observation_count,0) as observation_count,
       coalesce(o.price_observations,0) as price_observations,
       coalesce(o.rating_observations,0) as rating_observations,
       coalesce(o.review_observations,0) as review_observations,
       o.latest_observed_at,
       case
         when b.title is null or btrim(b.title)='' then 'REJECT'
         when b.t ~ '(paperback|hardcover|kindle|book|novel|dvd|blu-ray|audio cd|soundtrack)' then 'REJECT'
         when b.t ~ '(supplement|vitamin|capsule|tablet|medicine|medication|serum|perfume|fragrance|toner cartridge|ink cartridge)' then 'REJECT'
         when b.t ~ '(replacement part|oem replacement|compatible with [a-z0-9 -]+ model|for iphone [0-9]|for galaxy [a-z0-9])' then 'REJECT'
         else 'PASS'
       end as commercial_filter_status,
       array_remove(array[
         case when b.t ~ '(paperback|hardcover|kindle|book|novel|dvd|blu-ray|audio cd|soundtrack)' then 'MEDIA_OR_BOOK' end,
         case when b.t ~ '(supplement|vitamin|capsule|tablet|medicine|medication)' then 'REGULATED_HEALTH' end,
         case when b.t ~ '(serum|perfume|fragrance)' then 'BEAUTY_OR_LIQUID_RISK' end,
         case when b.t ~ '(toner cartridge|ink cartridge)' then 'CONSUMABLE_COMPATIBILITY_RISK' end,
         case when b.t ~ '(replacement part|oem replacement|compatible with [a-z0-9 -]+ model|for iphone [0-9]|for galaxy [a-z0-9])' then 'MODEL_SPECIFIC_RISK' end
       ],null) as commercial_filter_reasons
from base b left join obs o on o.product_id=b.id;

create or replace view public.trend_signal_v1 as
with r as (
  select product_id, observed_at, numeric_value,
         row_number() over(partition by product_id order by observed_at asc,id asc) as rn_first,
         row_number() over(partition by product_id order by observed_at desc,id desc) as rn_last,
         count(*) over(partition by product_id) as n
  from public.product_observations
  where observation_type in ('review_count','reviews') and numeric_value is not null
), agg as (
  select product_id,
         max(n) as review_points,
         max(numeric_value) filter(where rn_first=1) as first_reviews,
         max(numeric_value) filter(where rn_last=1) as latest_reviews,
         max(observed_at) filter(where rn_first=1) as first_reviews_at,
         max(observed_at) filter(where rn_last=1) as latest_reviews_at
  from r group by product_id
)
select p.id as product_id,
       coalesce(a.review_points,0) as review_points,
       a.first_reviews,a.latest_reviews,a.first_reviews_at,a.latest_reviews_at,
       case when a.first_reviews is not null and a.latest_reviews is not null then a.latest_reviews-a.first_reviews end as review_delta,
       case
         when coalesce(a.review_points,0)<2 then 'UNKNOWN'
         when a.latest_reviews_at<=a.first_reviews_at then 'UNKNOWN'
         when a.latest_reviews>a.first_reviews then 'POSITIVE_LONGITUDINAL'
         when a.latest_reviews=a.first_reviews then 'FLAT_LONGITUDINAL'
         when a.latest_reviews<a.first_reviews then 'CONFLICT_OR_DECLINE'
         else 'UNKNOWN' end as trend_class,
       case
         when coalesce(a.review_points,0)<2 then 'INSUFFICIENT_HISTORY'
         when a.latest_reviews_at-a.first_reviews_at < interval '7 days' then 'INSUFFICIENT_TIME_SPAN'
         else 'LONGITUDINAL_REVIEW_PROXY_NOT_SALES' end as trend_evidence_class
from public.canonical_products p left join agg a on a.product_id=p.id;

create or replace view public.romania_gap_signal_v1 as
with ro as (
  select product_id,
         count(distinct surface) as surfaces_any,
         count(distinct surface) filter(where observed_at>=now()-interval '90 days') as surfaces_current,
         max(comparability_confidence) as max_comparability_confidence,
         bool_or(market_wide_competition_ready) as market_wide_competition_ready,
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

create or replace view public.importability_signal_v1 as
select p.id as product_id,
       case
         when lower(coalesce(p.title,'')) ~ '(battery pack|lithium battery|power bank|aerosol|spray|liquid|chemical|pesticide|medicine|supplement)' then 'REJECT_RISK'
         when lower(coalesce(p.title,'')) ~ '(glass|ceramic|mirror)' then 'REVIEW_FRAGILITY'
         when lower(coalesce(p.title,'')) ~ '(sofa|mattress|wardrobe|table |chair set|large appliance)' then 'REVIEW_BULKY'
         when p.title is null or btrim(p.title)='' then 'UNKNOWN'
         else 'HEURISTIC_PASS' end as importability_class,
       case
         when lower(coalesce(p.title,'')) ~ '(battery pack|lithium battery|power bank)' then 'BATTERY_LOGISTICS_RISK'
         when lower(coalesce(p.title,'')) ~ '(aerosol|spray|liquid|chemical|pesticide)' then 'LIQUID_OR_HAZMAT_RISK'
         when lower(coalesce(p.title,'')) ~ '(medicine|supplement)' then 'REGULATORY_RISK'
         when lower(coalesce(p.title,'')) ~ '(glass|ceramic|mirror)' then 'FRAGILITY_REVIEW_REQUIRED'
         when lower(coalesce(p.title,'')) ~ '(sofa|mattress|wardrobe|table |chair set|large appliance)' then 'SIZE_WEIGHT_EVIDENCE_REQUIRED'
         else 'DIMENSIONS_WEIGHT_CERTIFICATIONS_STILL_REQUIRED' end as importability_reason,
       'TITLE_CATEGORY_HEURISTIC_ONLY'::text as evidence_class
from public.canonical_products p;

create or replace view public.economics_readiness_v1 as
with q as (
 select product_id,
        count(*) as supplier_quote_count,
        count(*) filter(where unit_price is not null and moq is not null) as usable_supplier_quote_count,
        max(confidence) as supplier_quote_confidence
 from public.supplier_quotes group by product_id
), ro_price as (
 select product_id,
        count(*) filter(where raw_evidence ? 'priceRon' or raw_evidence ? 'observedPriceRon') as local_price_evidence_count
 from public.romania_surface_observations group by product_id
)
select p.id as product_id,
       coalesce(q.supplier_quote_count,0) as supplier_quote_count,
       coalesce(q.usable_supplier_quote_count,0) as usable_supplier_quote_count,
       q.supplier_quote_confidence,
       coalesce(r.local_price_evidence_count,0) as local_price_evidence_count,
       case
         when coalesce(q.usable_supplier_quote_count,0)=0 then 'UNKNOWN_SUPPLIER_COST'
         when coalesce(r.local_price_evidence_count,0)=0 then 'UNKNOWN_ROMANIA_SELL_PRICE'
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
         when rg.positive_gap_human_verified=false then 'VALIDATE_ROMANIA_GAP'
         when e.economics_readiness<>'READY_FOR_CONSERVATIVE_ECONOMICS' then 'VALIDATE_ECONOMICS'
         else 'FINALIST_REVIEW_REQUIRED' end as decision_stage,
       case
         when c.commercial_filter_status='REJECT' then 'COMMERCIAL_FILTER_HARD_REJECT'
         when i.importability_class='REJECT_RISK' then 'IMPORTABILITY_HARD_REJECT'
         when t.trend_class='UNKNOWN' then 'NEED_LONGITUDINAL_TREND_EVIDENCE'
         when rg.romania_gap_class='UNKNOWN' then 'NEED_ROMANIA_EVIDENCE'
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

create or replace view public.intelligence_funnel_summary_v1 as
select decision_stage,count(*)::bigint as products
from public.opportunity_decision_v1
group by decision_stage
order by products desc;

comment on view public.opportunity_decision_v1 is 'Truth-first MPR decision funnel. No score can override hard gates; FINALIST_REVIEW_REQUIRED is not FINALIST authorization.';
