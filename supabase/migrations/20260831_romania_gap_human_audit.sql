-- Human Romania Gap audit layer.
-- Human review is evidence calibration only; it never promotes a product to FINALIST or BUY_READY.

create table if not exists public.romania_gap_human_audit (
  id bigserial primary key,
  benchmark_version text not null default 'R4',
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  verdict text not null check (verdict in ('HIGH_GAP','MEDIUM_GAP','LOW_GAP','INSUFFICIENT_EVIDENCE','FALSE_POSITIVE')),
  confidence numeric not null check (confidence>=0 and confidence<=1),
  current_surface_count integer not null check (current_surface_count>=0),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rationale text not null,
  reviewer text not null,
  reviewed_at timestamptz not null default now(),
  finalist_authorized boolean not null default false check (finalist_authorized=false),
  purchase_authorized boolean not null default false check (purchase_authorized=false),
  verified_sales boolean not null default false check (verified_sales=false),
  unique(benchmark_version,product_id)
);

alter table public.romania_gap_human_audit enable row level security;
revoke all on public.romania_gap_human_audit from anon, authenticated;

create index if not exists romania_gap_human_audit_verdict_idx
  on public.romania_gap_human_audit(benchmark_version,verdict,reviewed_at desc);

create or replace view public.romania_gap_human_review_queue_v1 as
select c.product_id,c.selection_rank,c.top_category,c.coverage_class,
       c.surfaces_with_current_evidence,c.max_comparability_confidence,
       c.last_observed_at,
       (a.id is not null) as reviewed,
       a.verdict,a.confidence as audit_confidence,a.reviewed_at
from public.romania_evidence_coverage_v1 c
left join public.romania_gap_human_audit a
  on a.benchmark_version='R4' and a.product_id=c.product_id
where c.eligible_for_human_romania_gap_review
order by (a.id is not null),c.selection_rank;

revoke all on public.romania_gap_human_review_queue_v1 from anon, authenticated;

create or replace view public.romania_gap_human_audit_summary_v1 as
select
  count(*) as reviewed_products,
  count(*) filter(where verdict='HIGH_GAP') as high_gap,
  count(*) filter(where verdict='MEDIUM_GAP') as medium_gap,
  count(*) filter(where verdict='LOW_GAP') as low_gap,
  count(*) filter(where verdict='INSUFFICIENT_EVIDENCE') as insufficient_evidence,
  count(*) filter(where verdict='FALSE_POSITIVE') as false_positive,
  round(100.0*count(*) filter(where verdict='FALSE_POSITIVE')/nullif(count(*),0),2) as false_positive_pct
from public.romania_gap_human_audit
where benchmark_version='R4';

revoke all on public.romania_gap_human_audit_summary_v1 from anon, authenticated;
