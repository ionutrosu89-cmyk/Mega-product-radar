create or replace function private.amazon_review_velocity_v1(p_window_days integer default 30)
returns table(
  product_id uuid,
  canonical_key text,
  title text,
  observation_count integer,
  first_reviews numeric,
  last_reviews numeric,
  review_delta numeric,
  span_days numeric,
  reviews_per_day numeric,
  evidence_class text,
  gate_reason text
)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
with base as (
  select o.product_id,o.observed_at,o.numeric_value
  from public.product_observations o
  where o.source_key='amazon_live_public_page_v1'
    and o.observation_type='review_count'
    and o.numeric_value is not null
    and o.observed_at >= now() - make_interval(days => greatest(1,least(coalesce(p_window_days,30),30)))
), counts as (
  select product_id,count(distinct observed_at)::integer as observation_count
  from base
  group by product_id
  having count(distinct observed_at) >= 2
), ranked as (
  select b.product_id,b.observed_at,b.numeric_value,
         row_number() over(partition by b.product_id order by b.observed_at asc) as rn_first,
         row_number() over(partition by b.product_id order by b.observed_at desc) as rn_last
  from base b
  join counts c on c.product_id=b.product_id
), agg as (
  select r.product_id,c.observation_count,
         max(r.numeric_value) filter(where r.rn_first=1) as first_reviews,
         max(r.observed_at) filter(where r.rn_first=1) as first_at,
         max(r.numeric_value) filter(where r.rn_last=1) as last_reviews,
         max(r.observed_at) filter(where r.rn_last=1) as last_at
  from ranked r join counts c on c.product_id=r.product_id
  group by r.product_id,c.observation_count
), scored as (
  select a.*, (a.last_reviews-a.first_reviews) as delta,
         extract(epoch from (a.last_at-a.first_at))/86400.0 as days
  from agg a
)
select s.product_id,c.canonical_key,c.title,s.observation_count,s.first_reviews,s.last_reviews,s.delta as review_delta,
       round(s.days::numeric,3) as span_days,
       case
         when s.days >= 1
          and s.delta >= 0
          and not (s.observation_count < 3 and s.delta > greatest(50::numeric,s.first_reviews*0.25))
         then round((s.delta/nullif(s.days,0))::numeric,3)
         else null
       end as reviews_per_day,
       case
         when s.days < 1 then 'INSUFFICIENT_DATA'
         when s.delta < 0 then 'INSUFFICIENT_DATA'
         when s.observation_count < 3 and s.delta > greatest(50::numeric,s.first_reviews*0.25) then 'INSUFFICIENT_DATA'
         else 'DERIVED'
       end as evidence_class,
       case
         when s.days < 1 then 'SPAN_LT_1_DAY'
         when s.delta < 0 then 'REVIEW_COUNT_DECREASED'
         when s.observation_count < 3 and s.delta > greatest(50::numeric,s.first_reviews*0.25) then 'LARGE_JUMP_NEEDS_THIRD_OBSERVATION'
         else 'PLAUSIBILITY_GATE_PASS'
       end as gate_reason
from scored s
join public.canonical_products c on c.id=s.product_id;
$$;

revoke all on function private.amazon_review_velocity_v1(integer) from public,anon,authenticated;
grant execute on function private.amazon_review_velocity_v1(integer) to postgres,service_role;
