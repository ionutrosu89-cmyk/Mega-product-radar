-- P0 record-level cloud sync V1.
-- Replaces workspace-wide batch replacement with stable record IDs + optimistic versions.
-- Old replacement batches are normalized once: only the newest batch per workspace is current state.

DO $$
DECLARE
  table_name text;
  index_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'suppliers',
    'supplier_offers',
    'rfq_dispatch_states',
    'landed_costs',
    'purchases',
    'portfolio_items',
    'feedback_events',
    'discovery_candidates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS sync_record_id text', table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS sync_version bigint NOT NULL DEFAULT 1', table_name);

    -- A prior batch is stale only when a strictly newer replacement batch exists for the same workspace.
    -- This preserves the entire newest batch while removing intentionally superseded copies.
    EXECUTE format($sql$
      DELETE FROM public.%1$I old_row
      WHERE old_row.sync_batch_id IS NOT NULL
        AND old_row.sync_batch_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.%1$I newer
          WHERE newer.workspace_id = old_row.workspace_id
            AND newer.sync_batch_id IS NOT NULL
            AND newer.sync_batch_at IS NOT NULL
            AND (newer.sync_batch_at, newer.sync_batch_id) > (old_row.sync_batch_at, old_row.sync_batch_id)
        )
    $sql$, table_name);

    -- Existing current rows become stable records. Their database UUID is a safe transition identity;
    -- clients pull it once and persist it in local metadata before any subsequent write.
    EXECUTE format('UPDATE public.%I SET sync_record_id = id::text WHERE sync_record_id IS NULL OR btrim(sync_record_id) = ''''', table_name);
    EXECUTE format('UPDATE public.%I SET sync_version = 1 WHERE sync_version IS NULL OR sync_version < 1', table_name);
    EXECUTE format('UPDATE public.%I SET sync_batch_id = NULL, sync_batch_at = NULL WHERE sync_record_id IS NOT NULL', table_name);

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN sync_record_id SET NOT NULL', table_name);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', table_name, table_name || '_sync_version_positive');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (sync_version > 0)', table_name, table_name || '_sync_version_positive');

    index_name := table_name || '_workspace_sync_record_uidx';
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I(workspace_id, sync_record_id)', index_name, table_name);
  END LOOP;
END $$;
