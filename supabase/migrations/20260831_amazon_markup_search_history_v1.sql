-- Historical Amazon search-result observations from The Markup (January 2021).
-- Truth contract: historical only, exact ASIN identity, no verified-sales inference.

insert into public.data_sources(
  source_key,provider,collection_method,allowed_use,redistribution_right,retention_rule,paid,enabled,metadata
) values (
  'the_markup_amazon_searches_2021',
  'The Markup News Inc.',
  'licensed_public_research_dataset',
  'internal_analytics',
  'BSD-3-Clause',
  'retain_pinned_historical_evidence',
  false,
  true,
  jsonb_build_object(
    'repository','the-markup/investigation-amazon-brands',
    'source_path','data/output/datasets/searches.csv.xz',
    'source_commit','b5ceaff65b1185bb619a6e950b445a23524fae65',
    'source_sha256','0071593ee788681df31110b1490fe2b71243003ece1666a415c06fa3f5cdd985',
    'license','BSD-3-Clause',
    'collection_window','2021-01',
    'freshness_class','HISTORICAL_2021_NOT_LIVE',
    'verified_sales',false,
    'provider_spend_eur',0,
    'paid_calls_triggered',0,
    'purchase_authorized',false
  )
) on conflict(source_key) do update set
  provider=excluded.provider,
  collection_method=excluded.collection_method,
  allowed_use=excluded.allowed_use,
  redistribution_right=excluded.redistribution_right,
  retention_rule=excluded.retention_rule,
  paid=false,
  enabled=true,
  metadata=excluded.metadata,
  updated_at=now();

create or replace function public.persist_amazon_markup_search_observations_v1(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
  v_asin text;
  v_product uuid;
  v_observed timestamptz;
  v_input integer:=0;
  v_matched integer:=0;
  v_inserted integer:=0;
  v_metric_count integer;
  v_raw_ref text;
begin
  if jsonb_typeof(p_rows)<>'array' then raise exception 'ROWS_ARRAY_REQUIRED'; end if;
  v_input:=jsonb_array_length(p_rows);
  if v_input<1 or v_input>250 then raise exception 'ROW_COUNT_OUT_OF_RANGE'; end if;

  for r in select value from jsonb_array_elements(p_rows)
  loop
    v_asin:=upper(nullif(btrim(r->>'externalId'),''));
    if v_asin is null or v_asin !~ '^[A-Z0-9]{10}$' then raise exception 'ASIN_INVALID:%',coalesce(v_asin,'NULL'); end if;
    if coalesce(r->>'evidenceClass','')<>'HISTORICAL_PUBLIC_SEARCH_RESULT' then raise exception 'EVIDENCE_CLASS_INVALID:%',v_asin; end if;
    if coalesce(r->>'freshnessClass','')<>'HISTORICAL_2021_NOT_LIVE' then raise exception 'FRESHNESS_CLASS_INVALID:%',v_asin; end if;
    if coalesce(r->>'observedAtPrecision','')<>'DAY' then raise exception 'OBSERVED_PRECISION_INVALID:%',v_asin; end if;
    if coalesce(r->>'salesEvidenceClass','')<>'NOT_VERIFIED_SALES' then raise exception 'SALES_EVIDENCE_INVALID:%',v_asin; end if;
    if coalesce((r->>'purchaseAuthorized')::boolean,false)<>false then raise exception 'PURCHASE_POLICY_INVALID:%',v_asin; end if;
    if coalesce(r->>'sourceDatasetSha256','')<>'0071593ee788681df31110b1490fe2b71243003ece1666a415c06fa3f5cdd985' then raise exception 'SOURCE_DIGEST_INVALID:%',v_asin; end if;

    begin v_observed:=(r->>'observedAt')::timestamptz; exception when others then raise exception 'OBSERVED_AT_INVALID:%',v_asin; end;
    if v_observed < timestamptz '2021-01-01 00:00:00+00' or v_observed >= timestamptz '2021-02-01 00:00:00+00' then
      raise exception 'OBSERVED_AT_OUTSIDE_JAN_2021:%',v_asin;
    end if;

    v_metric_count :=
      (case when r ? 'price' and (r->>'price') is not null then 1 else 0 end)+
      (case when r ? 'rating' and (r->>'rating') is not null then 1 else 0 end)+
      (case when r ? 'reviewCount' and (r->>'reviewCount') is not null then 1 else 0 end);
    if v_metric_count < 2 then raise exception 'MIN_TWO_METRICS_REQUIRED:%',v_asin; end if;

    if r ? 'price' and (r->>'price') is not null and (r->>'price')::numeric <= 0 then raise exception 'PRICE_INVALID:%',v_asin; end if;
    if r ? 'rating' and (r->>'rating') is not null and ((r->>'rating')::numeric < 0 or (r->>'rating')::numeric > 5) then raise exception 'RATING_INVALID:%',v_asin; end if;
    if r ? 'reviewCount' and (r->>'reviewCount') is not null and (r->>'reviewCount')::numeric < 0 then raise exception 'REVIEWS_INVALID:%',v_asin; end if;

    select pa.canonical_product_id into v_product
    from public.product_aliases pa
    where pa.platform='AMAZON' and upper(pa.external_id)=v_asin and pa.match_method='EXACT_SOURCE_ID'
    limit 1;
    if v_product is null then raise exception 'EXACT_ASIN_NOT_BOUND:%',v_asin; end if;
    v_matched:=v_matched+1;

    v_raw_ref:=coalesce(nullif(r->>'sourceUrl',''),'https://github.com/the-markup/investigation-amazon-brands/blob/b5ceaff65b1185bb619a6e950b445a23524fae65/data/output/datasets/searches.csv.xz');

    if r ? 'price' and (r->>'price') is not null then
      insert into public.product_observations(product_id,source_key,observation_type,observed_at,numeric_value,currency,confidence,raw_ref,payload)
      values(v_product,'the_markup_amazon_searches_2021','marketplace_listing_price',v_observed,(r->>'price')::numeric,'USD',0.90,v_raw_ref,
        jsonb_build_object('externalId',v_asin,'evidenceClass','HISTORICAL_PUBLIC_SEARCH_RESULT','freshnessClass','HISTORICAL_2021_NOT_LIVE','observedAtPrecision','DAY','verifiedSales',false,'sourceDatasetSha256',r->>'sourceDatasetSha256','sourceFilename',r->>'sourceFilename','searchTerm',r->>'searchTerm'))
      on conflict(product_id,source_key,observation_type,observed_at) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end if;
    if r ? 'rating' and (r->>'rating') is not null then
      insert into public.product_observations(product_id,source_key,observation_type,observed_at,numeric_value,confidence,raw_ref,payload)
      values(v_product,'the_markup_amazon_searches_2021','rating',v_observed,(r->>'rating')::numeric,0.90,v_raw_ref,
        jsonb_build_object('externalId',v_asin,'evidenceClass','HISTORICAL_PUBLIC_SEARCH_RESULT','freshnessClass','HISTORICAL_2021_NOT_LIVE','observedAtPrecision','DAY','verifiedSales',false,'sourceDatasetSha256',r->>'sourceDatasetSha256','sourceFilename',r->>'sourceFilename','searchTerm',r->>'searchTerm'))
      on conflict(product_id,source_key,observation_type,observed_at) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end if;
    if r ? 'reviewCount' and (r->>'reviewCount') is not null then
      insert into public.product_observations(product_id,source_key,observation_type,observed_at,numeric_value,confidence,raw_ref,payload)
      values(v_product,'the_markup_amazon_searches_2021','review_count',v_observed,(r->>'reviewCount')::numeric,0.90,v_raw_ref,
        jsonb_build_object('externalId',v_asin,'evidenceClass','HISTORICAL_PUBLIC_SEARCH_RESULT','freshnessClass','HISTORICAL_2021_NOT_LIVE','observedAtPrecision','DAY','verifiedSales',false,'sourceDatasetSha256',r->>'sourceDatasetSha256','sourceFilename',r->>'sourceFilename','searchTerm',r->>'searchTerm'))
      on conflict(product_id,source_key,observation_type,observed_at) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok',true,'inputRows',v_input,'matchedExactAsin',v_matched,'observationRowsInserted',v_inserted,
    'sourceKey','the_markup_amazon_searches_2021','freshnessClass','HISTORICAL_2021_NOT_LIVE','verifiedSales',false,
    'providerSpendEur',0,'paidCallsTriggered',0,'purchaseAuthorized',false
  );
end;
$$;

revoke all on function public.persist_amazon_markup_search_observations_v1(jsonb) from public, anon, authenticated;
grant execute on function public.persist_amazon_markup_search_observations_v1(jsonb) to service_role;
