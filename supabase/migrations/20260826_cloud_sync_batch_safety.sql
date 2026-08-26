-- P0 cloud sync safety: replacement batches are written before stale rows are removed.
-- This prevents the previous delete-all -> insert failure mode from losing workspace data.

alter table if exists public.suppliers add column if not exists sync_batch_id text;
alter table if exists public.suppliers add column if not exists sync_batch_at timestamptz;
create index if not exists suppliers_workspace_sync_batch_idx on public.suppliers(workspace_id,sync_batch_at desc);

alter table if exists public.supplier_offers add column if not exists sync_batch_id text;
alter table if exists public.supplier_offers add column if not exists sync_batch_at timestamptz;
create index if not exists supplier_offers_workspace_sync_batch_idx on public.supplier_offers(workspace_id,sync_batch_at desc);

alter table if exists public.rfq_dispatch_states add column if not exists sync_batch_id text;
alter table if exists public.rfq_dispatch_states add column if not exists sync_batch_at timestamptz;
create index if not exists rfq_dispatch_states_workspace_sync_batch_idx on public.rfq_dispatch_states(workspace_id,sync_batch_at desc);

alter table if exists public.landed_costs add column if not exists sync_batch_id text;
alter table if exists public.landed_costs add column if not exists sync_batch_at timestamptz;
create index if not exists landed_costs_workspace_sync_batch_idx on public.landed_costs(workspace_id,sync_batch_at desc);

alter table if exists public.purchases add column if not exists sync_batch_id text;
alter table if exists public.purchases add column if not exists sync_batch_at timestamptz;
create index if not exists purchases_workspace_sync_batch_idx on public.purchases(workspace_id,sync_batch_at desc);

alter table if exists public.portfolio_items add column if not exists sync_batch_id text;
alter table if exists public.portfolio_items add column if not exists sync_batch_at timestamptz;
create index if not exists portfolio_items_workspace_sync_batch_idx on public.portfolio_items(workspace_id,sync_batch_at desc);

alter table if exists public.feedback_events add column if not exists sync_batch_id text;
alter table if exists public.feedback_events add column if not exists sync_batch_at timestamptz;
create index if not exists feedback_events_workspace_sync_batch_idx on public.feedback_events(workspace_id,sync_batch_at desc);

alter table if exists public.discovery_candidates add column if not exists sync_batch_id text;
alter table if exists public.discovery_candidates add column if not exists sync_batch_at timestamptz;
create index if not exists discovery_candidates_workspace_sync_batch_idx on public.discovery_candidates(workspace_id,sync_batch_at desc);
