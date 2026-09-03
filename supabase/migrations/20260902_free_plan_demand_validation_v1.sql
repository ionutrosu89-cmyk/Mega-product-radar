begin;

-- Anonymous, first-party demand measurement for the public Free plan.
-- The event table never stores IP addresses, user agents, email addresses or account IDs.
create table if not exists public.free_demand_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_name text not null check (event_name in (
    'FREE_LANDING_VIEW',
    'FREE_TOP25_CTA_CLICK',
    'FREE_TOP25_VIEW',
    'FREE_NICHE_SELECTED',
    'FREE_PRODUCT_OPENED',
    'FREE_SOURCE_OPENED',
    'FREE_DECISION_REACHED',
    'FREE_SIGNUP_CTA_CLICK',
    'FREE_PRICING_CTA_CLICK'
  )),
  page text not null check (char_length(page) between 1 and 80),
  page_session_id uuid not null,
  niche_id text check (niche_id is null or char_length(niche_id) <= 80),
  acquisition_source text check (acquisition_source is null or char_length(acquisition_source) <= 80),
  acquisition_medium text check (acquisition_medium is null or char_length(acquisition_medium) <= 80),
  acquisition_campaign text check (acquisition_campaign is null or char_length(acquisition_campaign) <= 120),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 160),
  metadata jsonb not null default '{}'::jsonb,
  constraint free_demand_events_metadata_object check (jsonb_typeof(metadata)='object')
);

create index if not exists free_demand_events_name_time_idx
  on public.free_demand_events (event_name, occurred_at desc);
create index if not exists free_demand_events_niche_time_idx
  on public.free_demand_events (niche_id, occurred_at desc)
  where niche_id is not null;
create index if not exists free_demand_events_acquisition_time_idx
  on public.free_demand_events (acquisition_source, occurred_at desc)
  where acquisition_source is not null;
create index if not exists free_demand_events_session_time_idx
  on public.free_demand_events (page_session_id, occurred_at desc);

alter table public.free_demand_events enable row level security;
revoke all privileges on table public.free_demand_events from public, anon, authenticated;
grant select, insert, delete on table public.free_demand_events to service_role;

comment on table public.free_demand_events is
'Private, server-written Free-plan demand telemetry. No IP, user agent, email, account or persistent browser identifier is stored.';

-- Replace the eight legacy public-page-backed niches and add the 25th niche.
-- All published rows below come from the licensed Sep 2023 Amazon catalog snapshot.
with existing_asins as (
  select distinct product->>'asin' asin
  from public.top25_snapshots s
  cross join lateral jsonb_array_elements(s.products) product
),
base as (
  select
    substring(cp.canonical_key from '([A-Z0-9]{10})$') asin,
    cp.title,
    lower(cp.title) as title_lower
  from public.canonical_products cp
  where cp.canonical_key like 'source:AMAZON:%'
    and cp.title is not null
    and length(cp.title) between 20 and 180
    and not exists (
      select 1 from existing_asins e
      where e.asin=substring(cp.canonical_key from '([A-Z0-9]{10})$')
    )
    and lower(cp.title) !~ '(amazon basics|samsonite|travelpro|american tourister|tumi|eagle creek|herschel|adidas|nike|puma|reebok|disney|marvel|star wars|mickey|harry potter|hello kitty|jansport|osprey|north face|victorinox|delsey|philips|samsung|apple|sony|logitech|belkin|anker|ugreen|dremel|canon|dewalt|bosch|makita|milwaukee|stanley|black\+decker|fisher-price|fisher price|lego|vtech|hasbro|mattel|barbie|paw patrol|new balance|skechers|rawling|crayola|sharpie)'
),
tagged as (
  select *, case
    when title_lower ~ '(storage organizer|drawer organizer|kitchen organizer|shelf organizer|under sink organizer|vacuum storage bag)' then 'CASA'
    when title_lower ~ '(car seat organizer|car trash can|car phone holder|trunk organizer|seat gap filler|car cleaning brush)' then 'AUTO'
    when title_lower ~ '(usb hub|wireless charger|cable organizer|phone stand|webcam cover|laptop stand)' then 'ELECTRONICE'
    when title_lower ~ '(makeup brush cleaner|makeup organizer|scalp massager|facial ice roller|silicone face scrubber|travel makeup bag)' then 'BEAUTY'
    when title_lower ~ '(pet hair remover|dog lick mat|cat water fountain|pet grooming glove|dog paw cleaner|slow feeder bowl)' then 'PET'
    when title_lower ~ '(resistance band|yoga block|massage ball|ankle strap|push up board|workout slider)' then 'SPORT'
    when title_lower ~ '(busy board|sensory toy|bath toy organizer|stroller organizer|baby milestone card|kids drawing tablet)' then 'COPII'
    when title_lower ~ '(desk organizer|monitor stand|cable management|mouse pad|document holder|pen holder)' then 'BIROU'
    when title_lower ~ '(packing cube|travel pillow|toiletry bag|luggage scale|passport holder|travel bottle)' then 'CALATORII'
  end as niche_id
  from base
),
deduplicated as (
  select *, row_number() over (
    partition by niche_id, trim(regexp_replace(title_lower, '\([^)]*\)|\[[^]]*\]', '', 'g'))
    order by length(title), asin
  ) as variant_rank
  from tagged
  where niche_id is not null
),
ranked as (
  select *, row_number() over (
    partition by niche_id
    order by length(title), title, asin
  ) as internal_rank
  from deduplicated
  where variant_rank=1
),
snapshots as (
  select
    niche_id,
    jsonb_agg(jsonb_build_object(
      'name', title,
      'asin', asin,
      'rank', internal_rank,
      'sourceKey', 'KAGGLE_AMAZON_PRODUCTS_2023',
      'sourceLabel', 'Kaggle · Amazon Products Dataset 2023 (ODC-By)',
      'sourceUrl', 'https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products',
      'sourceTier', 'B',
      'sourceKind', 'HISTORICAL_DATASET',
      'sourcePeriod', 'snapshot Sep 2023',
      'sourceRank', null,
      'metric', null,
      'internalRankClass', 'DERIVED',
      'evidenceClass', 'DERIVED',
      'commercialGate', 'BRAND_REVIEW_REQUIRED'
    ) order by internal_rank) as products
  from ranked
  where internal_rank <= 25
  group by niche_id
  having count(*)=25
)
insert into public.top25_snapshots (niche_id, reviewed_at, products)
select niche_id, date '2026-09-02', products
from snapshots
on conflict (niche_id, reviewed_at) do update set products=excluded.products;

commit;
