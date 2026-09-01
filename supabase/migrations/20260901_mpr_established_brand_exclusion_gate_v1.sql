create table if not exists public.brand_exclusion_policy_v1 (
  brand_normalized text primary key,
  policy_class text not null check (policy_class in ('ESTABLISHED_EXCLUDE','SMALL_BRAND_ALLOWED','UNKNOWN_REVIEW')),
  reason text,
  source text not null default 'HUMAN_POLICY',
  updated_at timestamptz not null default now()
);

create or replace view public.brand_policy_gate_v1 as
select
  cp.id as product_id,
  cp.brand,
  lower(trim(coalesce(cp.brand,''))) as brand_normalized,
  coalesce(p.policy_class,
    case
      when lower(trim(coalesce(cp.brand,''))) in (
        'amazon basics','amazon essentials','avery','brother','canon','cricut','dremel','hanes','honeywell','liquitex','melissa & doug','new balance','pilot','rawlings','reebok','rotring','skechers','smith','swingline','valeo'
      ) then 'ESTABLISHED_EXCLUDE'
      else 'UNKNOWN_REVIEW'
    end
  ) as brand_policy_class,
  coalesce(p.reason,
    case
      when lower(trim(coalesce(cp.brand,''))) in (
        'amazon basics','amazon essentials','avery','brother','canon','cricut','dremel','hanes','honeywell','liquitex','melissa & doug','new balance','pilot','rawlings','reebok','rotring','skechers','smith','swingline','valeo'
      ) then 'Established brand excluded by sourcing strategy: avoid products likely to require authorization, licensed distribution, or brand-specific resale constraints.'
      else 'Brand size/authorization risk not yet classified.'
    end
  ) as brand_policy_reason,
  case
    when coalesce(p.policy_class,
      case when lower(trim(coalesce(cp.brand,''))) in (
        'amazon basics','amazon essentials','avery','brother','canon','cricut','dremel','hanes','honeywell','liquitex','melissa & doug','new balance','pilot','rawlings','reebok','rotring','skechers','smith','swingline','valeo'
      ) then 'ESTABLISHED_EXCLUDE' else 'UNKNOWN_REVIEW' end
    ) = 'ESTABLISHED_EXCLUDE' then false
    else true
  end as eligible_for_mpr_funnel
from public.canonical_products cp
left join public.brand_exclusion_policy_v1 p on p.brand_normalized = lower(trim(coalesce(cp.brand,'')));

comment on view public.brand_policy_gate_v1 is
'Hard sourcing gate: established brands are excluded from MPR commercial funnel; small brands may proceed; unknown brands require review.';

create or replace view public.golden_set_commercial_queue_v1 as
select
  g.*,
  b.brand_policy_class,
  b.brand_policy_reason,
  case
    when b.brand_policy_class='ESTABLISHED_EXCLUDE' then 'STOP_BRAND_GATE'
    when g.romania_gap_reviewed and g.romania_gap_verdict in ('FALSE_POSITIVE','REJECT') then 'STOP_GAP_FALSE_POSITIVE'
    when g.romania_gap_reviewed and g.romania_gap_verdict='LOW_GAP' then 'DEPRIORITIZE_LOW_GAP'
    when not g.romania_gap_reviewed and coalesce(g.surfaces_with_current_evidence,0)>=2 then 'REVIEW_ROMANIA_GAP'
    when not g.romania_gap_reviewed then 'COLLECT_ROMANIA_EVIDENCE'
    when g.importability_review_readiness='READY_FOR_HUMAN_IMPORTABILITY_REVIEW' and not coalesce(g.importability_approved,false) then 'REVIEW_IMPORTABILITY'
    else 'CONTINUE_VALIDATION'
  end as commercial_next_action,
  case
    when b.brand_policy_class='ESTABLISHED_EXCLUDE' then false
    when g.romania_gap_reviewed and g.romania_gap_verdict in ('FALSE_POSITIVE','REJECT') then false
    else true
  end as eligible_for_commercial_validation
from public.golden_set_review_packet_v1 g
join public.brand_policy_gate_v1 b on b.product_id=g.product_id;

comment on view public.golden_set_commercial_queue_v1 is
'Commercial validation queue with established-brand hard gate applied before Romania-gap, importability, economics and supplier validation.';
