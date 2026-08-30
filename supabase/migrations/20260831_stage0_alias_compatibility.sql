-- Preserve exact canonical identity for legacy Stage 0 alias writers after the
-- canonical product identity migration added required canonical_product_id/platform.
-- This is a compatibility bridge only: it derives the new columns from the same
-- already-authoritative product_id/source values and remains fail-closed if those
-- legacy values are missing.

create or replace function public.mpr_fill_product_alias_canonical_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.canonical_product_id is null then
    new.canonical_product_id := new.product_id;
  end if;

  if new.platform is null or btrim(new.platform) = '' then
    new.platform := upper(new.source);
  end if;

  return new;
end;
$$;

drop trigger if exists mpr_fill_product_alias_canonical_identity on public.product_aliases;
create trigger mpr_fill_product_alias_canonical_identity
before insert or update of product_id, source, canonical_product_id, platform
on public.product_aliases
for each row
execute function public.mpr_fill_product_alias_canonical_identity();

revoke execute on function public.mpr_fill_product_alias_canonical_identity() from public, anon, authenticated;
