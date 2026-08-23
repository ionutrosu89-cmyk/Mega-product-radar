-- Mega Product Radar · Stage 0 Budget Brain
-- Paid enrichment is allowed only for PROMISING / VALIDATE products.
-- Recent Romania snapshots are cache hits and should not be repurchased.
create or replace view public.v_stage0_paid_enrichment_candidates
with (security_invoker=true) as
select
  p.id as product_id,
  p.canonical_key,
  p.title,
  p.category,
  p.status,
  p.opportunity_score,
  p.evidence_confidence,
  p.priority_score,
  case p.status when 'PROMISING' then 100 when 'VALIDATE' then 90 else 0 end
    + coalesce(p.priority_score,0) * 0.50
    + greatest(0,100-coalesce(p.evidence_confidence,0)) * 0.25
    + case when not exists (
        select 1 from public.romania_market_snapshots r
        where r.product_id=p.id and r.observed_at >= now()-interval '30 days'
      ) then 20 else 0 end
    as information_value,
  0.05::numeric(10,4) as conservative_estimated_cost_eur,
  case
    when exists (
      select 1 from public.romania_market_snapshots r
      where r.product_id=p.id and r.observed_at >= now()-interval '30 days'
    ) then 'RECENT_RO_DATA'
    else 'NEEDS_RO_KEYWORD_ENRICHMENT'
  end as enrichment_reason
from public.canonical_products p
where p.status in ('PROMISING','VALIDATE')
order by information_value desc, p.priority_score desc nulls last, p.title;

revoke all on public.v_stage0_paid_enrichment_candidates from anon, authenticated;
