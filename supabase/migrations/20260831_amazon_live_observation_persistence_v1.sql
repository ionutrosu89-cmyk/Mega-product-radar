-- Persist pinned exact-ASIN Amazon live public-page observations.
-- No identity creation, no title merge, no sales inference, no provider spend.

insert into public.data_sources(source_key,provider,collection_method,allowed_use,redistribution_right,retention,paid,enabled,metadata)
values(
  'amazon_live_public_page_v1','Amazon public product pages via MPR live collector','public_product_page',
  'internal_analytics','not_assumed','retain_pinned_evidence',false,true,
  jsonb_build_object('evidenceClass','LIVE_PUBLIC_PRODUCT_PAGE','verifiedSales',false,'providerSpendEur',0,'paidCallsTriggered',0,'purchaseAuthorized',false)
)
on conflict(source_key) do update set enabled=true,paid=false,metadata=excluded.metadata;

create or replace function public.persist_amazon_live_observations_v1(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path=public as $function$
declare
  r jsonb;
  v_asin text;
  v_product uuid;
  v_observed timestamptz;
  v_url text;
  v_input integer:=0;
  v_matched integer:=0;
  v_inserted integer:=0;
begin
  if jsonb_typeof(p_rows)<>'array' then raise exception 'ROWS_ARRAY_REQUIRED'; end if;
  v_input:=jsonb_array_length(p_rows);
  if v_input<1 or v_input>500 then raise exception 'ROW_COUNT_OUT_OF_RANGE'; end if;

  for r in select value from jsonb_array_elements(p_rows)
  loop
    v_asin:=upper(nullif(btrim(r->>'externalId'),''));
    if v_asin is null or v_asin !~ '^[A-Z0-9]{10}$' then raise exception 'ASIN_INVALID:%',coalesce(v_asin,'NULL'); end if;
    if coalesce(r->>'evidenceClass','')<>'LIVE_PUBLIC_PRODUCT_PAGE' then raise exception 'EVIDENCE_CLASS_INVALID:%',v_asin; end if;
    if coalesce(r->>'salesEvidenceClass','')<>'NOT_VERIFIED_SALES' then raise exception 'SALES_EVIDENCE_INVALID:%',v_asin; end if;
    if coalesce((r->>'purchaseAuthorized')::boolean,false)<>false then raise exception 'PURCHASE_POLICY_INVALID:%',v_asin; end if;
    v_url:=r->>'sourceUrl';
    if v_url is null or v_url !~ ('^https://www\\.amazon\\.com/dp/'||v_asin||'([/?].*)?$') then raise exception 'SOURCE_URL_INVALID:%',v_asin; end if;
    begin v_observed:=(r->>'observedAt')::timestamptz; exception when others then raise exception 'OBSERVED_AT_INVALID:%',v_asin; end;
    if v_observed>now()+interval '5 minutes' then raise exception 'OBSERVED_AT_FUTURE:%',v_asin; end if;

    select pa.canonical_product_id into v_product
    from public.product_aliases pa
    where pa.platform='AMAZON' and upper(pa.external_id)=v_asin and pa.match_method='EXACT_SOURCE_ID'
    limit 1;
    if v_product is null then raise exception 'EXACT_ASIN_NOT_BOUND:%',v_asin; end if;
    v_matched:=v_matched+1;

    if r ? 'price' and (r->>'price') is not null then
      insert into public.product_observations(product_id,source_key,observation_type,observed_at,numeric_value,currency,confidence,raw_ref,payload)
      values(v_product,'amazon_live_public_page_v1','marketplace_listing_price',v_observed,(r->>'price')::numeric,coalesce(nullif(r->>'currency',''),'USD'),0.95,v_url,
        jsonb_build_object('externalId',v_asin,'evidenceClass','LIVE_PUBLIC_PRODUCT_PAGE','verifiedSales',false,'sourceKey',r->>'sourceKey'))
      on conflict(product_id,source_key,observation_type,observed_at) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end if;
    if r ? 'rating' and (r->>'rating') is not null then
      insert into public.product_observations(product_id,source_key,observation_type,observed_at,numeric_value,confidence,raw_ref,payload)
      values(v_product,'amazon_live_public_page_v1','rating',v_observed,(r->>'rating')::numeric,0.95,v_url,
        jsonb_build_object('externalId',v_asin,'evidenceClass','LIVE_PUBLIC_PRODUCT_PAGE','verifiedSales',false,'sourceKey',r->>'sourceKey'))
      on conflict(product_id,source_key,observation_type,observed_at) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end if;
    if r ? 'reviewCount' and (r->>'reviewCount') is not null then
      insert into public.product_observations(product_id,source_key,observation_type,observed_at,numeric_value,confidence,raw_ref,payload)
      values(v_product,'amazon_live_public_page_v1','review_count',v_observed,(r->>'reviewCount')::numeric,0.95,v_url,
        jsonb_build_object('externalId',v_asin,'evidenceClass','LIVE_PUBLIC_PRODUCT_PAGE','verifiedSales',false,'sourceKey',r->>'sourceKey'))
      on conflict(product_id,source_key,observation_type,observed_at) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'inputRows',v_input,'matchedExactAsin',v_matched,'observationRowsInserted',v_inserted,
    'sourceKey','amazon_live_public_page_v1','verifiedSales',false,'providerSpendEur',0,'paidCallsTriggered',0,'purchaseAuthorized',false);
end;$function$;

revoke all on function public.persist_amazon_live_observations_v1(jsonb) from public,anon,authenticated;
grant execute on function public.persist_amazon_live_observations_v1(jsonb) to service_role;
