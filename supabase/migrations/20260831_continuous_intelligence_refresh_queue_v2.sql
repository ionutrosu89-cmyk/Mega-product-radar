-- Continuous Intelligence Engine: extend the existing refresh_queue instead of creating a parallel scheduler.
-- This migration is additive and preserves all existing queue rows/workflows.

alter table public.refresh_queue
  add column if not exists target_surface text,
  add column if not exists evidence_kind text,
  add column if not exists priority_score numeric,
  add column if not exists shard_key text,
  add column if not exists dedupe_key text,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists provider_policy jsonb not null default '{"paid_calls_allowed":false,"purchase_authorized":false}'::jsonb;

update public.refresh_queue
set target_surface = coalesce(target_surface, 'GLOBAL'),
    evidence_kind = coalesce(evidence_kind, 'LEGACY_REFRESH'),
    priority_score = coalesce(priority_score, information_value, 0)
where target_surface is null
   or evidence_kind is null
   or priority_score is null;

create index if not exists refresh_queue_v2_due_priority_idx
  on public.refresh_queue (state, due_at, priority_score desc);

create index if not exists refresh_queue_v2_surface_due_idx
  on public.refresh_queue (target_surface, state, due_at);

create index if not exists refresh_queue_v2_shard_idx
  on public.refresh_queue (shard_key, state, due_at)
  where shard_key is not null;

create unique index if not exists refresh_queue_v2_active_dedupe_idx
  on public.refresh_queue (dedupe_key)
  where dedupe_key is not null and state in ('PENDING', 'LEASED', 'IN_PROGRESS');

-- Seed only the first audited benchmark: 100 exact Amazon identities x 3 Romania surfaces.
-- No provider is called here. The rows are scheduling intents only and default to zero spend.
with benchmark as (
  select
    pa.canonical_product_id as product_id,
    pa.external_id as asin,
    row_number() over (order by pa.external_id) as benchmark_rank
  from public.product_aliases pa
  where pa.platform = 'AMAZON'
    and pa.match_method = 'EXACT_SOURCE_ID'
    and pa.canonical_product_id is not null
    and pa.external_id ~ '^[A-Z0-9]{10}$'
  order by pa.external_id
  limit 100
), surfaces as (
  select * from (values
    ('EMAG_RO'::text, 'PRIMARY_MARKETPLACE'::text),
    ('TRENDYOL_RO'::text, 'SECONDARY_MARKETPLACE'::text),
    ('RO_RETAIL_WEB'::text, 'CORROBORATION'::text)
  ) as s(surface_key, surface_role)
), planned as (
  select
    b.product_id,
    b.asin,
    b.benchmark_rank,
    s.surface_key,
    s.surface_role,
    'RO:ASIN:' || b.asin || ':' || s.surface_key || ':INITIAL_V1' as dedupe_key
  from benchmark b
  cross join surfaces s
)
insert into public.refresh_queue (
  product_id,
  tier,
  reason,
  due_at,
  estimated_cost_eur,
  information_value,
  state,
  target_surface,
  evidence_kind,
  priority_score,
  shard_key,
  dedupe_key,
  provider_policy
)
select
  p.product_id,
  'HOT',
  'g2_romania_benchmark_initial_hydration',
  now(),
  0,
  1,
  'PENDING',
  p.surface_key,
  'ROMANIA_MARKET_EVIDENCE',
  100 - ((p.benchmark_rank - 1)::numeric / 1000),
  'RO_BENCHMARK_100_R1',
  p.dedupe_key,
  jsonb_build_object(
    'paid_calls_allowed', false,
    'purchase_authorized', false,
    'surface_role', p.surface_role,
    'unknown_remains_unknown', true,
    'historical_identity_is_not_live_evidence', true
  )
from planned p
where not exists (
  select 1
  from public.refresh_queue q
  where q.dedupe_key = p.dedupe_key
    and q.state in ('PENDING', 'LEASED', 'IN_PROGRESS')
);
