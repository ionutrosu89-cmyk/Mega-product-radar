-- Data Platform V3 originally reused public.suppliers, but that table already belongs to
-- workspace-scoped sourcing operations. Keep those records intact and give global supplier
-- intelligence its own namespace.

create table if not exists public.supplier_entities_v3 (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  display_name text not null,
  country text,
  verified_level text not null default 'UNVERIFIED'
    check (verified_level in ('UNVERIFIED','EVIDENCE_CHECKED','AGENT_TESTED')),
  agent_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, external_id)
);

alter table public.supplier_entities_v3 enable row level security;
revoke all on public.supplier_entities_v3 from anon,authenticated;

-- supplier_quotes was created by Data Platform V3 against public.suppliers because of the
-- historical table-name collision. Repoint only when there is no quote data to migrate.
do $$
declare quote_count bigint;
begin
  select count(*) into quote_count from public.supplier_quotes;
  if quote_count > 0 then
    raise exception 'SUPPLIER_QUOTES_NOT_EMPTY_MANUAL_MIGRATION_REQUIRED';
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid='public.supplier_quotes'::regclass
      and conname='supplier_quotes_supplier_id_fkey'
  ) then
    alter table public.supplier_quotes drop constraint supplier_quotes_supplier_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.supplier_quotes'::regclass
      and conname='supplier_quotes_supplier_entity_v3_fkey'
  ) then
    alter table public.supplier_quotes
      add constraint supplier_quotes_supplier_entity_v3_fkey
      foreign key (supplier_id) references public.supplier_entities_v3(id) on delete cascade;
  end if;
end $$;

create index if not exists supplier_entities_v3_source_idx on public.supplier_entities_v3(source,external_id);
