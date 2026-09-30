-- Retire only the public historical Top25 dataset; other snapshots are preserved.
delete from public.top25_snapshots
where products @> '[{"sourceKey":"KAGGLE_AMAZON_PRODUCTS_2023"}]'::jsonb;

alter table public.top25_snapshots
  add constraint top25_no_retired_amazon_archive_v1
  check (not (products @> '[{"sourceKey":"KAGGLE_AMAZON_PRODUCTS_2023"}]'::jsonb));
