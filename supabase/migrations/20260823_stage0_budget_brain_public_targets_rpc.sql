-- Read-only, non-PII allowlist for GitHub Actions paid enrichment.
-- Underlying V3 tables remain RLS-protected; only the minimal product allowlist is exposed.
create or replace function public.stage0_paid_targets()
returns table(
  canonical_key text,
  title text,
  status text,
  estimated_cost_eur numeric,
  information_value numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.canonical_key,
    e.title,
    e.status,
    e.conservative_estimated_cost_eur as estimated_cost_eur,
    e.information_value
  from public.v_stage0_paid_enrichment_candidates e
  where e.enrichment_reason='NEEDS_RO_KEYWORD_ENRICHMENT'
  order by e.information_value desc, e.priority_score desc, e.canonical_key
  limit 25;
$$;

revoke all on function public.stage0_paid_targets() from public;
grant execute on function public.stage0_paid_targets() to anon, authenticated;
comment on function public.stage0_paid_targets() is 'Read-only Stage 0 paid enrichment allowlist. No user, billing or private workspace data is returned.';
