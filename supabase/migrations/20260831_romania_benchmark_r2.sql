-- Romania benchmark R2: deterministic, quality-gated, category-diversified 100-product cohort.
-- R1 remains preserved for audit but is explicitly paused.

update public.refresh_queue
set provider_policy = coalesce(provider_policy,'{}'::jsonb) || jsonb_build_object(
  'benchmark_version','R1',
  'benchmark_status','PAUSED',
  'pause_reason','SELECTION_NOT_OPPORTUNITY_REPRESENTATIVE'
)
where evidence_kind='ROMANIA_MARKET_EVIDENCE'
  and shard_key='RO_BENCHMARK_100_R1';

create table if not exists public.romania_benchmark_membership (
  benchmark_version text not null,
  product_id uuid not null references public.canonical_products(id) on delete cascade,
  top_category text not null,
  observed_price numeric not null,
  review_count numeric,
  rating numeric,
  selection_rank integer not null,
  selection_rule text not null,
  status text not null check (status in ('ACTIVE','PAUSED','RETIRED')),
  created_at timestamptz not null default now(),
  primary key (benchmark_version,product_id)
);

with latest_price as (
  select distinct on (product_id) product_id,numeric_value price_value
  from public.product_observations
  where observation_type='marketplace_listing_price' and numeric_value is not null and numeric_value>0
  order by product_id,observed_at desc
), latest_reviews as (
  select distinct on (product_id) product_id,numeric_value review_count
  from public.product_observations
  where observation_type='review_count' and numeric_value is not null
  order by product_id,observed_at desc
), latest_rating as (
  select distinct on (product_id) product_id,numeric_value rating
  from public.product_observations
  where observation_type='rating' and numeric_value is not null
  order by product_id,observed_at desc
), eligible as (
  select p.id,p.title,
         case
           when coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),'')) like '[%'
             then coalesce((coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),''))::jsonb)->>0,'UNKNOWN')
           else coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),''))
         end top_category,
         lp.price_value,lr.review_count,lrt.rating,
         row_number() over (
           partition by case
             when coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),'')) like '[%'
               then coalesce((coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),''))::jsonb)->>0,'UNKNOWN')
             else coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),''))
           end
           order by coalesce(lr.review_count,0) desc,coalesce(lrt.rating,0) desc,p.id
         ) category_rank
  from public.canonical_products p
  join latest_price lp on lp.product_id=p.id
  join latest_reviews lr on lr.product_id=p.id
  join latest_rating lrt on lrt.product_id=p.id
  where coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),'')) is not null
    and lp.price_value between 10 and 80
    and lower(p.title) !~ '(book|novel|paperback|hardcover|toner|ink cartridge|chemical|pool clarifier|battery pack|supplement|perfume|fragrance|medicine|cream|serum|oil|lotion|food|snack|drink|beverage)'
    and lower(coalesce(p.category,'')) !~ '(grocery|food|beauty.*fragrance)'
), diversified as (
  select *,row_number() over(order by category_rank,top_category,coalesce(review_count,0) desc,id) global_rank
  from eligible
  where category_rank<=6
), chosen as (
  select * from diversified where global_rank<=100
)
insert into public.romania_benchmark_membership(
  benchmark_version,product_id,top_category,observed_price,review_count,rating,selection_rank,selection_rule,status
)
select 'R2',id,top_category,price_value,review_count,rating,global_rank,
       'CATEGORY_AND_PRICE_AND_REVIEW_RATING;PRICE_10_80;EXCLUDE_HIGH_RISK_OR_NON_IMPORTABLE_TITLE_CLASSES;MAX_6_PER_TOP_CATEGORY',
       'ACTIVE'
from chosen
on conflict (benchmark_version,product_id) do update
set top_category=excluded.top_category,
    observed_price=excluded.observed_price,
    review_count=excluded.review_count,
    rating=excluded.rating,
    selection_rank=excluded.selection_rank,
    selection_rule=excluded.selection_rule,
    status='ACTIVE';

-- One intent per selected product per Romanian evidence surface.
insert into public.refresh_queue(
  product_id,tier,reason,due_at,estimated_cost_eur,information_value,state,target_surface,evidence_kind,
  priority_score,shard_key,dedupe_key,provider_policy
)
select m.product_id,
       case when m.selection_rank<=20 then 'HOT' else 'ACTIVE' end,
       'g2_romania_benchmark_r2_quality_hydration',
       now(),0,
       greatest(1,101-m.selection_rank),
       'PENDING',
       s.surface,
       'ROMANIA_MARKET_EVIDENCE',
       greatest(1,101-m.selection_rank),
       'RO_BENCHMARK_100_R2',
       'RO:R2:'||m.product_id::text||':'||s.surface||':INITIAL_V1',
       jsonb_build_object(
         'benchmark_version','R2',
         'benchmark_status','ACTIVE',
         'selection_rank',m.selection_rank,
         'top_category',m.top_category,
         'observed_price',m.observed_price,
         'surface_role',s.surface_role,
         'paid_calls_allowed',false,
         'purchase_authorized',false,
         'unknown_remains_unknown',true,
         'historical_identity_is_not_live_evidence',true
       )
from public.romania_benchmark_membership m
cross join (values
  ('EMAG_RO','PRIMARY_MARKETPLACE'),
  ('TRENDYOL_RO','SECONDARY_MARKETPLACE'),
  ('RO_RETAIL_WEB','CORROBORATION')
) s(surface,surface_role)
where m.benchmark_version='R2' and m.status='ACTIVE'
on conflict (dedupe_key) where dedupe_key is not null and state in ('PENDING','LEASED','IN_PROGRESS')
do nothing;

create or replace function public.claim_romania_refresh_jobs_v1(p_owner text,p_limit integer default 10,p_lease_seconds integer default 600)
returns table (id bigint,product_id uuid,target_surface text,evidence_kind text,tier text,priority_score numeric,attempt_count integer,title text,category text,canonical_key text)
language plpgsql security definer set search_path=public as $function$
begin
  if nullif(btrim(p_owner),'') is null then raise exception 'LEASE_OWNER_REQUIRED'; end if;
  if p_limit<1 or p_limit>25 then raise exception 'LEASE_LIMIT_OUT_OF_RANGE'; end if;
  if p_lease_seconds<60 or p_lease_seconds>1800 then raise exception 'LEASE_SECONDS_OUT_OF_RANGE'; end if;
  return query
  with picked as (
    select q.id from public.refresh_queue q
    where q.state='PENDING' and q.due_at<=now()
      and q.target_surface in ('EMAG_RO','TRENDYOL_RO','RO_RETAIL_WEB')
      and q.evidence_kind='ROMANIA_MARKET_EVIDENCE'
      and q.provider_policy->>'benchmark_status'='ACTIVE'
      and coalesce(q.estimated_cost_eur,0)=0
      and coalesce((q.provider_policy->>'paid_calls_allowed')::boolean,false)=false
      and coalesce((q.provider_policy->>'purchase_authorized')::boolean,false)=false
    order by coalesce(q.priority_score,0) desc,q.due_at asc,q.id asc
    for update skip locked limit p_limit
  ), leased as (
    update public.refresh_queue q
    set state='RUNNING',lease_owner=p_owner,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),attempt_count=coalesce(q.attempt_count,0)+1,last_error=null
    from picked where q.id=picked.id returning q.*
  )
  select l.id,l.product_id,l.target_surface,l.evidence_kind,l.tier,l.priority_score,l.attempt_count,p.title,p.category,p.canonical_key
  from leased l join public.canonical_products p on p.id=l.product_id
  order by coalesce(l.priority_score,0) desc,l.id asc;
end;$function$;
