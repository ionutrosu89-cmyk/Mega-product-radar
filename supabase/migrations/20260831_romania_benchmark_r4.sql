-- Romania benchmark R4: exact top-category filtering and exact 100-product cohort.
-- R1/R2/R3 remain preserved but paused for audit/calibration.

update public.refresh_queue
set provider_policy=coalesce(provider_policy,'{}'::jsonb)||jsonb_build_object(
  'benchmark_status','PAUSED',
  'pause_reason','SUPERSEDED_BY_R4_EXACT_TOP_CATEGORY'
), due_at=greatest(due_at,now()+interval '14 days')
where shard_key in ('RO_BENCHMARK_100_R1','RO_BENCHMARK_100_R2','RO_BENCHMARK_100_R3');

update public.romania_benchmark_membership set status='PAUSED'
where benchmark_version in ('R1','R2','R3') and status='ACTIVE';

with latest_price as (
  select distinct on(product_id) product_id,numeric_value price_value
  from public.product_observations
  where observation_type='marketplace_listing_price' and numeric_value is not null and numeric_value>0
  order by product_id,observed_at desc
), latest_reviews as (
  select distinct on(product_id) product_id,numeric_value review_count
  from public.product_observations
  where observation_type='review_count' and numeric_value is not null
  order by product_id,observed_at desc
), latest_rating as (
  select distinct on(product_id) product_id,numeric_value rating
  from public.product_observations
  where observation_type='rating' and numeric_value is not null
  order by product_id,observed_at desc
), base as (
  select p.id,p.title,
    case when coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),'')) like '[%'
      then coalesce((coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),''))::jsonb)->>0,'UNKNOWN')
      else coalesce(nullif(btrim(p.category),''),nullif(btrim(p.canonical_category),'')) end top_category,
    lp.price_value,lr.review_count,lrt.rating
  from public.canonical_products p
  join latest_price lp on lp.product_id=p.id
  join latest_reviews lr on lr.product_id=p.id
  join latest_rating lrt on lrt.product_id=p.id
  where lp.price_value between 15 and 60
    and lr.review_count between 20 and 20000
    and lrt.rating>=3.8
    and lower(p.title) !~ '(book|novel|paperback|hardcover|album|vinyl|cd |dvd|whirlpool|replacement|compatible with|designed for|iphone|ipad|samsung|galaxy|vans|nike|adidas|puma|toner|ink cartridge|chemical|supplement|perfume|fragrance|medicine|cream|serum|oil|lotion|detergent|food|snack|drink|beverage|battery pack|charger for|filter for|part number|cartridge|robe|glove|shoe|sneaker)'
), eligible as (
  select *,row_number() over(partition by top_category order by review_count desc,rating desc,id) category_rank
  from base
  where top_category in ('Home & Kitchen','Automotive','Baby Products','Pet Supplies','Sports & Outdoors','Office Products','Electronics','Cell Phones & Accessories','Tools & Home Improvement','Toys & Games')
), diversified as (
  select *,row_number() over(order by category_rank,top_category,review_count desc,rating desc,id) global_rank
  from eligible where category_rank<=20
), chosen as (
  select * from diversified where global_rank<=100
)
insert into public.romania_benchmark_membership(
  benchmark_version,product_id,top_category,observed_price,review_count,rating,selection_rank,selection_rule,status
)
select 'R4',id,top_category,price_value,review_count,rating,global_rank,
  'EXACT_TOP_CATEGORY;IMPORTABILITY_FIRST;PRICE_15_60;REVIEWS_20_20000;RATING_GTE_3_8;EXCLUDE_MEDIA_BRAND_SPECIFIC_CHEMICAL_CONSUMABLE_SPARE_PART_FASHION;MAX_20_PER_CATEGORY',
  'ACTIVE'
from chosen
on conflict (benchmark_version,product_id) do update set
  top_category=excluded.top_category,observed_price=excluded.observed_price,review_count=excluded.review_count,
  rating=excluded.rating,selection_rank=excluded.selection_rank,selection_rule=excluded.selection_rule,status='ACTIVE';

insert into public.refresh_queue(
  product_id,tier,reason,due_at,estimated_cost_eur,information_value,state,target_surface,evidence_kind,
  priority_score,shard_key,dedupe_key,provider_policy
)
select m.product_id,
  case when m.selection_rank<=20 then 'HOT' else 'ACTIVE' end,
  'g2_romania_benchmark_r4_exact_top_category',now(),0,greatest(1,101-m.selection_rank),'PENDING',
  s.surface,'ROMANIA_MARKET_EVIDENCE',greatest(1,101-m.selection_rank),'RO_BENCHMARK_100_R4',
  'RO:R4:'||m.product_id::text||':'||s.surface||':INITIAL_V1',
  jsonb_build_object(
    'benchmark_version','R4','benchmark_status','ACTIVE','selection_rank',m.selection_rank,
    'top_category',m.top_category,'observed_price',m.observed_price,'surface_role',s.surface_role,
    'paid_calls_allowed',false,'purchase_authorized',false,'unknown_remains_unknown',true,
    'historical_identity_is_not_live_evidence',true)
from public.romania_benchmark_membership m
cross join (values
  ('EMAG_RO','PRIMARY_MARKETPLACE'),('TRENDYOL_RO','SECONDARY_MARKETPLACE'),('RO_RETAIL_WEB','CORROBORATION')
) s(surface,surface_role)
where m.benchmark_version='R4' and m.status='ACTIVE'
  and not exists (
    select 1 from public.refresh_queue q
    where q.dedupe_key='RO:R4:'||m.product_id::text||':'||s.surface||':INITIAL_V1'
  );
