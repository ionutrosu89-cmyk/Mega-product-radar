-- Romania Evidence Inbox: controlled manual/indexed evidence ingestion.
-- Purpose: allow auditable Romania evidence when direct marketplace access is blocked/unavailable.
-- Indexed/manual evidence never upgrades itself to direct marketplace evidence.

create table if not exists public.romania_evidence_inbox (
  id bigserial primary key,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  surface text not null check (surface in ('EMAG_RO','TRENDYOL_RO','RO_RETAIL_WEB')),
  source_url text not null,
  observed_at timestamptz not null,
  search_query text,
  evidence_class text not null check (evidence_class in ('MANUAL_INDEXED_WEB','DIRECT_PUBLIC_PAGE','MANUAL_MARKETPLACE_PAGE')),
  identity_status text not null default 'UNKNOWN' check (identity_status in ('EXACT','COMPARABLE','AMBIGUOUS','UNKNOWN','REJECTED')),
  comparability_confidence numeric check (comparability_confidence is null or (comparability_confidence>=0 and comparability_confidence<=1)),
  observed_price numeric,
  currency text,
  product_link_lower_bound integer check (product_link_lower_bound is null or product_link_lower_bound>=0),
  seller_count integer check (seller_count is null or seller_count>=0),
  title_candidate text,
  freshness_class text not null default 'UNKNOWN',
  raw_evidence jsonb not null default '{}'::jsonb,
  status text not null default 'NEW' check (status in ('NEW','ACCEPTED','REJECTED')),
  rejection_reason text,
  reviewed_at timestamptz,
  reviewer text,
  created_at timestamptz not null default now(),
  unique(product_id,surface,source_url,observed_at,evidence_class)
);

alter table public.romania_evidence_inbox enable row level security;
revoke all on public.romania_evidence_inbox from anon, authenticated;

create index if not exists romania_evidence_inbox_review_idx
  on public.romania_evidence_inbox(status,surface,observed_at desc);
create index if not exists romania_evidence_inbox_product_idx
  on public.romania_evidence_inbox(product_id,surface,observed_at desc);

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

  insert into public.romania_surface_observations(
    product_id,surface,observed_at,evidence_class,freshness_class,source_url,search_query,
    product_link_lower_bound,seller_count,comparable_scope_confirmed,market_wide_competition_ready,
    sales_evidence_class,comparability_confidence,collector_version,raw_evidence
  ) values (
    r.product_id,r.surface,r.observed_at,r.evidence_class,r.freshness_class,r.source_url,r.search_query,
    r.product_link_lower_bound,r.seller_count,(r.identity_status in ('EXACT','COMPARABLE')),false,
    'NOT_VERIFIED_SALES',r.comparability_confidence,'romania-evidence-inbox-v1',
    r.raw_evidence || jsonb_build_object(
      'inboxId',r.id,'identityStatus',r.identity_status,'observedPrice',r.observed_price,
      'currency',r.currency,'titleCandidate',r.title_candidate,
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
    'salesEvidenceClass','NOT_VERIFIED_SALES');
end;$function$;

revoke all on function public.accept_romania_evidence_inbox_v1(bigint,text) from public,anon,authenticated;
