begin;

create or replace function public.mpr_guard_catalog_identity_rebind_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    raise exception 'CATALOG_IDENTITY_REBIND_FORBIDDEN';
  end if;
  return new;
end;
$$;

revoke all on function public.mpr_guard_catalog_identity_rebind_v1() from public, anon, authenticated;
grant execute on function public.mpr_guard_catalog_identity_rebind_v1() to service_role;

drop trigger if exists trg_mpr_guard_catalog_identity_rebind_v1 on public.product_identity_keys_v2;
create trigger trg_mpr_guard_catalog_identity_rebind_v1
before update of product_id on public.product_identity_keys_v2
for each row
execute function public.mpr_guard_catalog_identity_rebind_v1();

comment on function public.mpr_guard_catalog_identity_rebind_v1() is
  'P0 fail-closed guard: an existing canonical identity key may not be rebound to a different canonical product by upsert or manual update.';

commit;
