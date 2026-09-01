-- Reconcile Romania refresh priorities after Importability V2.
-- Preserve queued evidence history; only remove intelligence acceleration from products
-- that now require importability evidence before Romania collection.

update public.refresh_queue q
set priority_score = least(coalesce(q.priority_score,0), 100),
    due_at = greatest(q.due_at, now() + interval '7 days'),
    reason = 'IMPORTABILITY_EVIDENCE_REQUIRED_BEFORE_ROMANIA_V2'
where q.state='PENDING'
  and q.reason='INTELLIGENCE_PRIORITY_ROMANIA_V1'
  and q.target_surface in ('TRENDYOL_RO','RO_RETAIL_WEB')
  and exists (
    select 1
    from public.intelligence_priority_queue_v1 iq
    where iq.product_id=q.product_id
      and iq.workstream='IMPORTABILITY_EVIDENCE'
  );

-- Keep/restore maximum intelligence priority only for products that remain eligible
-- for Romania evidence after the new importability gate.
update public.refresh_queue q
set priority_score = greatest(coalesce(q.priority_score,0),1000),
    due_at = least(q.due_at,now()),
    reason = 'INTELLIGENCE_PRIORITY_ROMANIA_V2'
where q.state='PENDING'
  and q.evidence_kind='ROMANIA_MARKET_EVIDENCE'
  and q.target_surface in ('TRENDYOL_RO','RO_RETAIL_WEB')
  and q.provider_policy->>'benchmark_status'='ACTIVE'
  and coalesce(q.estimated_cost_eur,0)=0
  and coalesce((q.provider_policy->>'paid_calls_allowed')::boolean,false)=false
  and coalesce((q.provider_policy->>'purchase_authorized')::boolean,false)=false
  and exists (
    select 1
    from public.intelligence_priority_queue_v1 iq
    where iq.product_id=q.product_id
      and iq.workstream in ('ROMANIA_FIRST_SURFACE','ROMANIA_SECOND_SURFACE_OR_AUDIT')
  );

-- eMAG is intentionally untouched while direct access remains blocked.
