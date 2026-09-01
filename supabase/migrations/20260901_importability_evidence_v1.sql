-- MPR Importability Evidence V1
-- Adds explicit evidence for logistics / brand-variant review.
-- UNKNOWN remains explicit. Only human-verified decisions can override heuristics.

create table if not exists public.importability_evidence_v1 (
  id bigserial primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('DIMENSIONS','WEIGHT','MATERIAL','CERTIFICATION','BRAND_VARIANT','IMPORTABILITY_DECISION')),
  evidence_value jsonb not null default '{}'::jsonb,
  source_kind text not null check (source_kind in ('PUBLIC_PRODUCT_PAGE','SUPPLIER_LISTING','SUPPLIER_QUOTE','HUMAN_REVIEW','OTHER')),
  source_ref text,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  human_verified boolean not null default false,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint importability_decision_payload_check check (
    evidence_type <> 'IMPORTABILITY_DECISION'
    or evidence_value->>'decision' in ('PASS','REJECT','UNKNOWN')
  )
);

create index if not exists importability_evidence_v1_product_idx
  on public.importability_evidence_v1(product_id, observed_at desc);
create index if not exists importability_evidence_v1_type_idx
  on public.importability_evidence_v1(evidence_type, human_verified, observed_at desc);

alter table public.importability_evidence_v1 enable row level security;

create or replace view public.importability_human_decision_v1 as
select distinct on (product_id)
       product_id,
       evidence_value->>'decision' as decision,
       source_ref,
       confidence,
       observed_at
from public.importability_evidence_v1
where evidence_type='IMPORTABILITY_DECISION'
  and human_verified=true
order by product_id, observed_at desc, id desc;

create or replace view public.importability_evidence_coverage_v1 as
select p.id as product_id,
       count(e.id) as evidence_records,
       count(e.id) filter (where e.evidence_type='DIMENSIONS') as dimensions_records,
       count(e.id) filter (where e.evidence_type='WEIGHT') as weight_records,
       count(e.id) filter (where e.evidence_type='MATERIAL') as material_records,
       count(e.id) filter (where e.evidence_type='CERTIFICATION') as certification_records,
       count(e.id) filter (where e.evidence_type='BRAND_VARIANT') as brand_variant_records,
       count(e.id) filter (where e.human_verified) as human_verified_records,
       max(e.observed_at) as latest_evidence_at
from public.canonical_products p
left join public.importability_evidence_v1 e on e.product_id=p.id
group by p.id;

create or replace view public.importability_signal_v1 as
select p.id as product_id,
       case
         when hd.decision='REJECT' then 'REJECT_RISK'
         when hd.decision='PASS' then 'EVIDENCE_PASS'
         when lower(coalesce(p.title,'')) ~ '(battery pack|lithium battery|power bank|aerosol|spray|liquid|chemical|pesticide|medicine|supplement|wood filler|adhesive|sealant|solvent|resin|glue)' then 'REJECT_RISK'
         when lower(coalesce(p.title,'')) ~ '(glass|mirror|ceramic (mug|bowl|plate|dish|vase|container|cookware|cup|jar))' then 'REVIEW_FRAGILITY'
         when lower(coalesce(p.title,'')) ~ '(sofa|mattress|wardrobe|table |chair set|large appliance|toilet seat|1000 count|case of [0-9]{3,})' then 'REVIEW_BULKY'
         when lower(coalesce(p.category,'')) like '%clothing%'
           or lower(coalesce(p.category,'')) like '%shoes%'
           or lower(coalesce(p.title,'')) ~ '(discontinued|nfl |nba |mlb |nhl )' then 'REVIEW_BRAND_VARIANT'
         when p.title is null or btrim(p.title)='' then 'UNKNOWN'
         else 'HEURISTIC_PASS' end as importability_class,
       case
         when hd.decision='REJECT' then 'HUMAN_VERIFIED_IMPORTABILITY_REJECT'
         when hd.decision='PASS' then 'HUMAN_VERIFIED_IMPORTABILITY_PASS'
         when lower(coalesce(p.title,'')) ~ '(battery pack|lithium battery|power bank)' then 'BATTERY_LOGISTICS_RISK'
         when lower(coalesce(p.title,'')) ~ '(aerosol|spray|liquid|chemical|pesticide|wood filler|adhesive|sealant|solvent|resin|glue)' then 'LIQUID_OR_HAZMAT_RISK'
         when lower(coalesce(p.title,'')) ~ '(medicine|supplement)' then 'REGULATORY_RISK'
         when lower(coalesce(p.title,'')) ~ '(glass|mirror|ceramic (mug|bowl|plate|dish|vase|container|cookware|cup|jar))' then 'FRAGILITY_REVIEW_REQUIRED'
         when lower(coalesce(p.title,'')) ~ '(sofa|mattress|wardrobe|table |chair set|large appliance|toilet seat|1000 count|case of [0-9]{3,})' then 'SIZE_WEIGHT_EVIDENCE_REQUIRED'
         when lower(coalesce(p.category,'')) like '%clothing%'
           or lower(coalesce(p.category,'')) like '%shoes%'
           or lower(coalesce(p.title,'')) ~ '(discontinued|nfl |nba |mlb |nhl )' then 'BRAND_VARIANT_IP_REVIEW_REQUIRED'
         else 'DIMENSIONS_WEIGHT_CERTIFICATIONS_STILL_REQUIRED' end as importability_reason,
       case when hd.decision in ('PASS','REJECT') then 'HUMAN_VERIFIED_REVIEW' else 'TITLE_CATEGORY_HEURISTIC_ONLY' end::text as evidence_class
from public.canonical_products p
left join public.importability_human_decision_v1 hd on hd.product_id=p.id;

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
         when i.importability_class in ('REVIEW_FRAGILITY','REVIEW_BULKY','REVIEW_BRAND_VARIANT','UNKNOWN') then 'VALIDATE_IMPORTABILITY'
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
         when i.importability_class in ('REVIEW_FRAGILITY','REVIEW_BULKY','REVIEW_BRAND_VARIANT','UNKNOWN') then i.importability_reason
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
         when o.decision_stage='VALIDATE_IMPORTABILITY' then 95
         when o.decision_stage='VALIDATE_ROMANIA_GAP' then 90
         when o.decision_stage='PROMISING_NEEDS_ROMANIA' then 80
         when o.decision_stage='DISCOVERED' and o.commercial_filter_status='PASS' then 40
         else 0 end as information_priority,
       case
         when o.decision_stage='VALIDATE_ECONOMICS' then 'ECONOMICS'
         when o.decision_stage='VALIDATE_IMPORTABILITY' then 'IMPORTABILITY_EVIDENCE'
         when o.decision_stage='VALIDATE_ROMANIA_GAP' then 'ROMANIA_SECOND_SURFACE_OR_AUDIT'
         when o.decision_stage='PROMISING_NEEDS_ROMANIA' then 'ROMANIA_FIRST_SURFACE'
         when o.decision_stage='DISCOVERED' and o.commercial_filter_status='PASS' then 'TREND_HISTORY'
         else 'NO_ACTION' end as workstream
from public.opportunity_decision_v1 o
where o.decision_stage not like 'REJECTED%'
order by information_priority desc,coalesce(o.review_delta,0) desc,o.canonical_key;

create or replace view public.importability_evidence_queue_v1 as
select q.product_id,q.canonical_key,q.title,q.brand,q.category,
       q.importability_class,q.importability_reason,q.review_delta,
       c.evidence_records,c.dimensions_records,c.weight_records,c.material_records,c.certification_records,c.brand_variant_records,c.human_verified_records,c.latest_evidence_at,
       case
         when q.importability_class='REVIEW_BULKY' then array['DIMENSIONS','WEIGHT']::text[]
         when q.importability_class='REVIEW_FRAGILITY' then array['MATERIAL','DIMENSIONS']::text[]
         when q.importability_class='REVIEW_BRAND_VARIANT' then array['BRAND_VARIANT']::text[]
         else array['IMPORTABILITY_DECISION']::text[] end as required_evidence
from public.intelligence_priority_queue_v1 q
join public.importability_evidence_coverage_v1 c on c.product_id=q.product_id
where q.workstream='IMPORTABILITY_EVIDENCE';

comment on table public.importability_evidence_v1 is 'Audited importability evidence. Only human_verified IMPORTABILITY_DECISION records may override title/category heuristics.';
comment on view public.importability_evidence_queue_v1 is 'Products requiring importability evidence before Romania collection. Review is not rejection.';
