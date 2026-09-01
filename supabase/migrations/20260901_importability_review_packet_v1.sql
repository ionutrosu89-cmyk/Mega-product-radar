-- MPR Importability Human Review Packet V1
-- Read-only service-side packet for products with complete required evidence.
-- READY means evidence-complete only; it never approves importability or authorizes FINALIST/BUY/purchase.

create or replace view public.importability_human_review_packet_v1 as
with evidence_rollup as (
  select
    e.product_id,
    count(*) as evidence_records,
    max(e.confidence) as max_confidence,
    bool_or(e.human_verified) as has_human_verified_evidence,
    jsonb_agg(
      jsonb_build_object(
        'evidenceType', e.evidence_type,
        'evidenceValue', e.evidence_value,
        'sourceKind', e.source_kind,
        'sourceRef', e.source_ref,
        'confidence', e.confidence,
        'humanVerified', e.human_verified,
        'observedAt', e.observed_at
      ) order by e.observed_at desc, e.id desc
    ) as evidence
  from public.importability_evidence_v1 e
  where e.evidence_type <> 'IMPORTABILITY_DECISION'
  group by e.product_id
)
select
  r.product_id,
  r.title,
  r.brand,
  r.category,
  r.importability_class,
  r.importability_reason,
  r.required_evidence,
  r.review_readiness,
  coalesce(er.evidence_records,0) as evidence_records,
  er.max_confidence,
  coalesce(er.has_human_verified_evidence,false) as has_human_verified_evidence,
  coalesce(er.evidence,'[]'::jsonb) as evidence,
  hd.decision as latest_human_decision,
  hd.confidence as latest_human_decision_confidence,
  hd.observed_at as latest_human_decision_at,
  case when hd.decision is null then 'PENDING_HUMAN_REVIEW' else 'HUMAN_DECISION_RECORDED' end as review_state,
  true as human_review_required,
  false as finalist_authorized,
  false as buy_ready,
  false as purchase_authorized,
  false as verified_sales
from public.importability_review_readiness_v1 r
left join evidence_rollup er on er.product_id=r.product_id
left join public.importability_human_decision_v1 hd on hd.product_id=r.product_id
where r.review_readiness='READY_FOR_HUMAN_IMPORTABILITY_REVIEW';

revoke all on public.importability_human_review_packet_v1 from anon, authenticated;

comment on view public.importability_human_review_packet_v1 is
  'Evidence-complete importability review packets. READY is not PASS. Human decision remains mandatory; no FINALIST, BUY_READY or purchase authority is granted.';
