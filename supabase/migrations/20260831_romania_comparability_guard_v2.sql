-- Romania comparability guard v2.
-- Hard identity mismatches must fail closed and rejected observations must not contribute to coverage.

alter table public.romania_evidence_inbox
  add column if not exists expected_unit_count integer check (expected_unit_count is null or expected_unit_count>0),
  add column if not exists candidate_unit_count integer check (candidate_unit_count is null or candidate_unit_count>0),
  add column if not exists unit_count_status text not null default 'UNKNOWN' check (unit_count_status in ('MATCH','MISMATCH','UNKNOWN')),
  add column if not exists form_factor_status text not null default 'UNKNOWN' check (form_factor_status in ('MATCH','MISMATCH','UNKNOWN')),
  add column if not exists hard_mismatch_reason text;

create table if not exists public.romania_observation_quality_review (
  id bigserial primary key,
  observation_id bigint not null unique references public.romania_surface_observations(id) on delete cascade,
  verdict text not null check (verdict in ('ACCEPTED','REJECTED')),
  reason_code text not null check (reason_code in ('HUMAN_ACCEPTED','PACK_SIZE_MISMATCH','FORM_FACTOR_MISMATCH','MODEL_VARIANT_MISMATCH','CATEGORY_MISMATCH','OTHER_HARD_MISMATCH')),
  rationale text not null,
  reviewer text not null,
  reviewed_at timestamptz not null default now()
);

alter table public.romania_observation_quality_review enable row level security;
revoke all on public.romania_observation_quality_review from anon, authenticated;

create index if not exists romania_observation_quality_review_verdict_idx
  on public.romania_observation_quality_review(verdict,reason_code,reviewed_at desc);

create or replace function public.accept_romania_evidence_inbox_v1(p_id bigint,p_reviewer text)
returns jsonb
language plpgsql security definer set search_path=public as $function$
declare r public.romania_evidence_inbox%rowtype; promoted_id bigint;
begin
  if nullif(btrim(p_reviewer),'') is null then raise exception 'REVIEWER_REQUIRED'; end if;
  select * into r from public.romania_evidence_inbox where id=p_id for update;
  if not found then raise exception 'INBOX_ITEM_NOT_FOUND'; end if;
  if r.status<>'NEW' then raise exception 'INBOX_ITEM_NOT_NEW'; end if;
  if r.identity_status not in ('EXACT','COMPARABLE') then raise exception 'IDENTITY_NOT_ACCEPTABLE'; end if;
  if r.comparability_confidence is null or r.comparability_confidence<0.70 then raise exception 'COMPARABILITY_TOO_LOW'; end if;
  if r.observed_at>now()+interval '5 minutes' then raise exception 'OBSERVED_AT_IN_FUTURE'; end if;

  if r.unit_count_status='MISMATCH' then raise exception 'HARD_UNIT_COUNT_MISMATCH'; end if;
  if r.expected_unit_count is not null and r.candidate_unit_count is not null
     and r.expected_unit_count<>r.candidate_unit_count then
    raise exception 'HARD_UNIT_COUNT_MISMATCH';
  end if;
  if r.form_factor_status='MISMATCH' then raise exception 'HARD_FORM_FACTOR_MISMATCH'; end if;
  if nullif(btrim(r.hard_mismatch_reason),'') is not null then raise exception 'HARD_COMPARABILITY_MISMATCH'; end if;

  insert into public.romania_surface_observations(
    product_id,surface,observed_at,evidence_class,freshness_class,source_url,search_query,
    product_link_lower_bound,seller_count,comparable_scope_confirmed,market_wide_competition_ready,
    sales_evidence_class,comparability_confidence,collector_version,raw_evidence
  ) values (
    r.product_id,r.surface,r.observed_at,r.evidence_class,r.freshness_class,r.source_url,r.search_query,
    r.product_link_lower_bound,r.seller_count,(r.identity_status in ('EXACT','COMPARABLE')),false,
    'NOT_VERIFIED_SALES',r.comparability_confidence,'romania-evidence-inbox-v2',
    r.raw_evidence || jsonb_build_object(
      'inboxId',r.id,'identityStatus',r.identity_status,'observedPrice',r.observed_price,
      'currency',r.currency,'titleCandidate',r.title_candidate,
      'expectedUnitCount',r.expected_unit_count,'candidateUnitCount',r.candidate_unit_count,
      'unitCountStatus',r.unit_count_status,'formFactorStatus',r.form_factor_status,
      'truthCeiling',case when r.evidence_class='MANUAL_INDEXED_WEB' then 'CORROBORATION_ONLY' else 'DIRECT_PAGE_NOT_MARKET_WIDE' end,
      'verifiedSales',false
    )
  )
  on conflict(product_id,surface,observed_at,collector_version) do nothing
  returning id into promoted_id;

  update public.romania_evidence_inbox
  set status='ACCEPTED',reviewed_at=now(),reviewer=p_reviewer,rejection_reason=null
  where id=p_id;

  return jsonb_build_object('ok',true,'inboxId',p_id,'observationId',promoted_id,
    'surface',r.surface,'evidenceClass',r.evidence_class,'marketWideCompetitionReady',false,
    'salesEvidenceClass','NOT_VERIFIED_SALES','comparabilityGuardVersion','v2');
end;$function$;

revoke all on function public.accept_romania_evidence_inbox_v1(bigint,text) from public,anon,authenticated;

create or replace view public.romania_evidence_coverage_v1 as
with r4 as (
  select product_id,selection_rank,top_category
  from public.romania_benchmark_membership
  where benchmark_version='R4' and status='ACTIVE'
), valid_observations as (
  select o.*
  from public.romania_surface_observations o
  left join public.romania_observation_quality_review q on q.observation_id=o.id
  where coalesce(q.verdict,'ACCEPTED')<>'REJECTED'
), obs as (
  select o.product_id,o.surface,
         count(*) as observation_count,
         max(o.observed_at) as last_observed_at,
         bool_or(
           o.freshness_class is not null
           and o.freshness_class not in ('UNKNOWN','HISTORICAL_BOOTSTRAP_NOT_LIVE')
           and o.freshness_class not like 'INDEXED_STALE%'
         ) as has_current_evidence,
         bool_or(o.freshness_class like 'INDEXED_STALE%' or o.freshness_class='HISTORICAL_BOOTSTRAP_NOT_LIVE') as has_stale_evidence,
         max(o.comparability_confidence) as max_comparability_confidence
  from valid_observations o
  join r4 on r4.product_id=o.product_id
  group by o.product_id,o.surface
), product_rollup as (
  select r4.product_id,r4.selection_rank,r4.top_category,
    count(distinct obs.surface) filter(where obs.observation_count>0) as surfaces_with_any_evidence,
    count(distinct obs.surface) filter(where obs.has_current_evidence) as surfaces_with_current_evidence,
    count(distinct obs.surface) filter(where obs.has_stale_evidence and not obs.has_current_evidence) as surfaces_stale_only,
    max(obs.last_observed_at) as last_observed_at,
    max(obs.max_comparability_confidence) as max_comparability_confidence
  from r4 left join obs on obs.product_id=r4.product_id
  group by r4.product_id,r4.selection_rank,r4.top_category
)
select *,
  case
    when surfaces_with_current_evidence>=3 then 'CURRENT_3_SURFACES'
    when surfaces_with_current_evidence=2 then 'CURRENT_2_SURFACES'
    when surfaces_with_current_evidence=1 then 'CURRENT_1_SURFACE'
    when surfaces_with_any_evidence>0 then 'STALE_ONLY'
    else 'UNKNOWN'
  end as coverage_class,
  (surfaces_with_current_evidence>=2 and coalesce(max_comparability_confidence,0)>=0.70) as eligible_for_human_romania_gap_review,
  false as market_wide_competition_ready
from product_rollup;

revoke all on public.romania_evidence_coverage_v1 from anon, authenticated;

create or replace view public.romania_evidence_coverage_summary_v1 as
select
  count(*) as benchmark_products,
  count(*) filter(where surfaces_with_any_evidence>0) as products_any_evidence,
  count(*) filter(where surfaces_with_current_evidence>0) as products_current_evidence,
  count(*) filter(where surfaces_with_current_evidence>=2) as products_current_2plus_surfaces,
  count(*) filter(where surfaces_with_current_evidence>=3) as products_current_3_surfaces,
  count(*) filter(where coverage_class='STALE_ONLY') as products_stale_only,
  count(*) filter(where coverage_class='UNKNOWN') as products_unknown,
  count(*) filter(where eligible_for_human_romania_gap_review) as products_human_review_eligible,
  round(100.0*count(*) filter(where surfaces_with_current_evidence>0)/nullif(count(*),0),2) as current_coverage_pct,
  round(100.0*count(*) filter(where coverage_class='UNKNOWN')/nullif(count(*),0),2) as unknown_pct
from public.romania_evidence_coverage_v1;

revoke all on public.romania_evidence_coverage_summary_v1 from anon, authenticated;
