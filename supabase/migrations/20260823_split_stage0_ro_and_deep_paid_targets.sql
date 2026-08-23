create or replace view public.v_stage0_paid_enrichment_candidates as
select
  p.id as product_id,
  p.canonical_key,
  p.title,
  p.category,
  p.status,
  p.opportunity_score,
  p.evidence_confidence,
  p.priority_score,
  (
    case p.status when 'VALIDATE' then 120 when 'PROMISING' then 80 else 0 end
    + coalesce(p.priority_score,0) * 0.50
    + greatest(0,100-coalesce(p.evidence_confidence,0)) * 0.25
    + case when not exists (
        select 1 from public.romania_market_snapshots r
        where r.product_id=p.id and r.observed_at >= now()-interval '30 days'
      ) then 20 else 0 end
  )::numeric as information_value,
  0.05::numeric(10,4) as conservative_estimated_cost_eur,
  case when exists (
    select 1 from public.romania_market_snapshots r
    where r.product_id=p.id and r.observed_at >= now()-interval '30 days'
  ) then 'RECENT_RO_DATA' else 'NEEDS_RO_KEYWORD_ENRICHMENT' end as enrichment_reason
from public.canonical_products p
where p.status in ('PROMISING','VALIDATE')
order by information_value desc, p.priority_score desc nulls last, p.title;

create or replace function public.stage0_ro_keyword_targets()
returns table(canonical_key text,title text,status text,estimated_cost_eur numeric,information_value numeric)
language sql stable security definer set search_path=public
as $$
  select e.canonical_key,e.title,e.status,e.conservative_estimated_cost_eur,e.information_value
  from public.v_stage0_paid_enrichment_candidates e
  where e.enrichment_reason='NEEDS_RO_KEYWORD_ENRICHMENT'
  order by e.information_value desc,e.priority_score desc,e.canonical_key
  limit 25;
$$;

create or replace function public.stage0_deep_marketplace_targets()
returns table(canonical_key text,title text,status text,estimated_cost_eur numeric,information_value numeric)
language sql stable security definer set search_path=public
as $$
  select
    p.canonical_key,
    p.title,
    p.status,
    0.05::numeric(10,4) as estimated_cost_eur,
    (
      case p.status when 'VALIDATE' then 200 when 'PROMISING' then 80 else 0 end
      + coalesce(p.priority_score,0)
      + coalesce(p.opportunity_score,0)
      + greatest(0,100-coalesce(p.evidence_confidence,0))*0.25
    )::numeric as information_value
  from public.canonical_products p
  where p.status in ('VALIDATE','PROMISING')
  order by
    case p.status when 'VALIDATE' then 0 else 1 end,
    p.priority_score desc nulls last,
    p.opportunity_score desc nulls last,
    p.canonical_key
  limit 10;
$$;

create or replace function public.stage0_paid_targets()
returns table(canonical_key text,title text,status text,estimated_cost_eur numeric,information_value numeric)
language sql stable security definer set search_path=public
as $$
  select * from public.stage0_ro_keyword_targets();
$$;

grant execute on function public.stage0_ro_keyword_targets() to anon, authenticated;
grant execute on function public.stage0_deep_marketplace_targets() to anon, authenticated;
grant execute on function public.stage0_paid_targets() to anon, authenticated;
