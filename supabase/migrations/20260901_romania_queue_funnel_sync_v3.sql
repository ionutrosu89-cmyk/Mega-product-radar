-- MPR Romania Queue Funnel Sync V3
-- Aligns only pending TRENDYOL_RO / RO_RETAIL_WEB jobs with the current decision engine.
-- No deletion, no eMAG changes, no paid provider or purchase authority.

update public.refresh_queue r
set priority_score=1000,
    due_at=least(r.due_at,now()),
    reason=case
      when o.decision_stage='VALIDATE_ROMANIA_GAP' then 'INTELLIGENCE_PRIORITY_ROMANIA_SECOND_SURFACE_V3'
      else 'INTELLIGENCE_PRIORITY_ROMANIA_FIRST_SURFACE_V3' end,
    provider_policy=coalesce(r.provider_policy,'{}'::jsonb) || jsonb_build_object(
      'intelligenceSyncVersion','V3',
      'decisionStage',o.decision_stage,
      'paid_calls_allowed',false,
      'purchase_authorized',false
    )
from public.opportunity_decision_v1 o
where r.product_id=o.product_id
  and r.state='PENDING'
  and r.target_surface in ('TRENDYOL_RO','RO_RETAIL_WEB')
  and o.decision_stage in ('PROMISING_NEEDS_ROMANIA','VALIDATE_ROMANIA_GAP');

update public.refresh_queue r
set priority_score=least(r.priority_score,100),
    due_at=greatest(r.due_at,now()+interval '7 days'),
    reason='IMPORTABILITY_EVIDENCE_REQUIRED_BEFORE_ROMANIA_V3',
    provider_policy=coalesce(r.provider_policy,'{}'::jsonb) || jsonb_build_object(
      'intelligenceSyncVersion','V3',
      'decisionStage','VALIDATE_IMPORTABILITY',
      'paid_calls_allowed',false,
      'purchase_authorized',false
    )
from public.opportunity_decision_v1 o
where r.product_id=o.product_id
  and r.state='PENDING'
  and r.target_surface in ('TRENDYOL_RO','RO_RETAIL_WEB')
  and o.decision_stage='VALIDATE_IMPORTABILITY';
