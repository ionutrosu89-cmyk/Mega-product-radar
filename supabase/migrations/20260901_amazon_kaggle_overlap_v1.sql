-- Read-only exact-ASIN overlap classifier for Amazon 500K scale.
create or replace function public.classify_existing_amazon_asins_v1(p_asins text[])
returns jsonb
language plpgsql security definer set search_path=public as $function$
declare v_count int; v_existing jsonb;
begin
  v_count:=coalesce(array_length(p_asins,1),0);
  if v_count<1 or v_count>5000 then raise exception 'ASIN_BATCH_SCOPE_INVALID'; end if;
  if exists(select 1 from unnest(p_asins) a where a !~ '^[A-Z0-9]{10}$') then raise exception 'ASIN_FORMAT_INVALID'; end if;
  select coalesce(jsonb_agg(distinct pa.external_id order by pa.external_id),'[]'::jsonb)
  into v_existing
  from public.product_aliases pa
  where pa.platform='AMAZON' and pa.external_id=any(p_asins);
  return jsonb_build_object('inputCount',v_count,'existingAsins',v_existing,'writePerformed',false);
end;$function$;
revoke all on function public.classify_existing_amazon_asins_v1(text[]) from public,anon,authenticated;
comment on function public.classify_existing_amazon_asins_v1(text[]) is 'Service-only read-only exact Amazon ASIN overlap classifier; max 5000; no writes.';
