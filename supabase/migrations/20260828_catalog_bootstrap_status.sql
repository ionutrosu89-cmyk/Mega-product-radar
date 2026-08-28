-- P0: align canonical_products status constraint with the catalogue bootstrap pipeline.
-- Preserve every existing lifecycle status and add the analysis-only catalogue state.

alter table public.canonical_products
  drop constraint if exists canonical_products_status_check;

alter table public.canonical_products
  add constraint canonical_products_status_check
  check (status = any (array[
    'DISCOVERED'::text,
    'PROMISING'::text,
    'VALIDATE'::text,
    'FINALIST'::text,
    'TEST_READY'::text,
    'BUY_READY'::text,
    'ARCHIVED'::text,
    'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'::text
  ]));

comment on constraint canonical_products_status_check on public.canonical_products is
  'Allows legacy product lifecycle statuses plus CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY for rights-bounded canonical catalogue ingestion. This status does not imply ranking, commercial use, verified sales, or purchase authorization.';
