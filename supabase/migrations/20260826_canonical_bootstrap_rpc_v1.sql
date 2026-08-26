-- Server-only canonical bootstrap resolver.
-- Exact (platform, external_id) is the only automatic identity rule.
-- Titles are display metadata and are never used to merge aliases.

create or replace function public.resolve_canonical_bootstrap_batch_v1(
  p_rows jsonb,
  p_source_digest text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_platform text;
  v_external_id text;
  v_title text;
  v_brand text;
  v_category text;
  v_market text;
  v_source_url text;
  v_product_id uuid;
  v_existing boolean;
  v_created integer := 0;
  v_resolved integer := 0;
  v_rejected integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'ROWS_ARRAY_REQUIRED';
  end if;
  if jsonb_array_length(p_rows) > 250 then
    raise exception 'BATCH_TOO_LARGE_MAX_250';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    v_platform := upper(trim(coalesce(item->>'platform','')));
    v_external_id := trim(coalesce(item->>'externalId',item->>'external_id',''));
    v_title := nullif(trim(coalesce(item->>'title','')), '');
    v_brand := nullif(trim(coalesce(item->>'brand','')), '');
    v_category := nullif(trim(coalesce(item->>'categoryLabel',item->>'category','')), '');
    v_market := nullif(upper(trim(coalesce(item->>'market',''))), '');
    v_source_url := nullif(trim(coalesce(item->>'sourceUrl',item->>'source_url','')), '');

    if v_platform = '' or v_external_id = '' then
      v_rejected := v_rejected + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('externalId',v_external_id,'status','REJECTED','reason','PLATFORM_AND_EXTERNAL_ID_REQUIRED'));
      continue;
    end if;

    select pa.canonical_product_id into v_product_id
    from public.product_aliases pa
    where pa.platform = v_platform and pa.external_id = v_external_id
    limit 1;

    v_existing := v_product_id is not null;

    if not v_existing then
      -- Legacy Data Platform V3 keeps title/canonical_key non-null. Refuse to invent a title.
      if v_title is null then
        v_rejected := v_rejected + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object('externalId',v_external_id,'status','REJECTED','reason','TITLE_REQUIRED_FOR_NEW_CANONICAL'));
        continue;
      end if;

      select cp.id into v_product_id
      from public.canonical_products cp
      where cp.canonical_key = 'source:' || v_platform || ':' || v_external_id
      limit 1;

      if v_product_id is null then
        insert into public.canonical_products(
          canonical_key,title,brand,category,status,canonical_name,canonical_category,identity_status
        ) values (
          'source:' || v_platform || ':' || v_external_id,
          v_title,v_brand,v_category,'DISCOVERED',v_title,v_category,'ACTIVE'
        ) returning id into v_product_id;
        v_created := v_created + 1;
      end if;

      insert into public.product_aliases(
        product_id,source,external_id,marketplace,title,url,fingerprint,
        canonical_product_id,platform,market,observed_title,title_fingerprint,source_url,
        match_method,manually_reviewed,updated_at
      ) values (
        v_product_id,v_platform,v_external_id,v_market,v_title,v_source_url,null,
        v_product_id,v_platform,v_market,v_title,null,v_source_url,
        'EXACT_SOURCE_ID',false,now()
      )
      on conflict (source,external_id) do update set
        canonical_product_id = excluded.canonical_product_id,
        platform = excluded.platform,
        market = coalesce(public.product_aliases.market, excluded.market),
        observed_title = coalesce(excluded.observed_title, public.product_aliases.observed_title),
        source_url = coalesce(excluded.source_url, public.product_aliases.source_url),
        updated_at = now();
    end if;

    v_resolved := v_resolved + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'externalId',v_external_id,
      'canonicalProductId',v_product_id,
      'status',case when v_existing then 'RESOLVED_EXISTING_ALIAS' else 'RESOLVED_CANONICAL' end
    ));
  end loop;

  return jsonb_build_object(
    'schemaVersion','MPR_CANONICAL_BOOTSTRAP_BATCH_RESULT_V1',
    'sourceDigest',p_source_digest,
    'inputCount',jsonb_array_length(p_rows),
    'resolvedCount',v_resolved,
    'createdCanonicalCount',v_created,
    'rejectedCount',v_rejected,
    'results',v_results,
    'purchaseAuthorized',false,
    'paidCallsTriggered',0,
    'providerSpendEur',0
  );
end;
$$;

revoke execute on function public.resolve_canonical_bootstrap_batch_v1(jsonb,text) from public,anon,authenticated;
grant execute on function public.resolve_canonical_bootstrap_batch_v1(jsonb,text) to service_role;
