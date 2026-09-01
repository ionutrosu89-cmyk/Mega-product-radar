begin;

create table if not exists public.viral_romania_validation_targets_v1(
  id bigserial primary key,
  concept_id uuid not null unique references public.viral_product_concepts_v1(id) on delete cascade,
  canonical_product_id uuid references public.canonical_products(id),
  priority_score numeric not null,
  lifecycle text not null,
  search_queries text[] not null default '{}',
  target_surfaces text[] not null default array['TRENDYOL_RO','RO_RETAIL_WEB'],
  status text not null default 'PENDING' check(status in ('PENDING','IN_REVIEW','CANONICALIZED','REJECTED','HELD')),
  route_reason text not null,
  routed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer text,
  review_reason text,
  provider_data_spend_eur numeric not null default 0 check(provider_data_spend_eur=0),
  purchase_authorized boolean not null default false check(purchase_authorized=false)
);
alter table public.viral_romania_validation_targets_v1 enable row level security;
revoke all on public.viral_romania_validation_targets_v1 from anon,authenticated;
create index if not exists viral_romania_targets_priority_idx on public.viral_romania_validation_targets_v1(status,priority_score desc,routed_at);

create or replace function public.route_viral_candidates_to_romania_v1()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_count integer:=0;
begin
  insert into public.viral_romania_validation_targets_v1(concept_id,priority_score,lifecycle,search_queries,status,route_reason)
  select c.id,coalesce(s.viral_score,0),s.lifecycle,
    case when cardinality(c.generic_search_terms)>0 then c.generic_search_terms else array[c.concept_name] end,
    'PENDING','CROSS_PLATFORM_FOREIGN_ACCELERATION_NEEDS_ROMANIA_VALIDATION'
  from public.viral_product_concepts_v1 c join public.viral_candidate_scores_v1 s on s.concept_id=c.id
  where c.brand_policy_class in ('GENERIC_PRIVATE_LABEL','SMALL_BRAND_ALLOWED')
    and s.lifecycle in ('ACCELERATING','VIRAL') and s.observation_count>=2 and s.platform_count>=2 and s.foreign_country_count>=2
    and s.romania_evidence_class='UNVERIFIED'
  on conflict(concept_id) do update set priority_score=excluded.priority_score,lifecycle=excluded.lifecycle,search_queries=excluded.search_queries,
    routed_at=now(),route_reason=excluded.route_reason
  where public.viral_romania_validation_targets_v1.status in ('PENDING','HELD');
  get diagnostics v_count=row_count;
  return jsonb_build_object('schema','MPR_VIRAL_ROMANIA_ROUTING_RECEIPT_V1','targetsRouted',v_count,'targetSurfaces',jsonb_build_array('TRENDYOL_RO','RO_RETAIL_WEB'),'emagDirectEnumeration',false,'providerDataSpendEur',0,'purchaseAuthorized',false,'romaniaGapAssigned',false);
end;$$;
revoke all on function public.route_viral_candidates_to_romania_v1() from public,anon,authenticated;
grant execute on function public.route_viral_candidates_to_romania_v1() to service_role;

create or replace view public.viral_romania_validation_queue_v1 as
select t.id,t.concept_id,c.concept_name,c.category,c.brand_policy_class,t.priority_score,t.lifecycle,t.search_queries,t.target_surfaces,t.status,t.route_reason,t.routed_at,
  s.observation_count,s.platform_count,s.foreign_country_count,s.viral_score,
  'UNKNOWN'::text as romania_gap_verdict,false as romania_gap_validated,false as purchase_authorized
from public.viral_romania_validation_targets_v1 t
join public.viral_product_concepts_v1 c on c.id=t.concept_id
join public.viral_candidate_scores_v1 s on s.concept_id=t.concept_id
where t.status in ('PENDING','IN_REVIEW','HELD');

comment on view public.viral_romania_validation_queue_v1 is 'Pre-canonical Romania research queue. Routing indicates investigation priority only; it never assigns Romania Gap or commercial eligibility.';
commit;
