begin;

create or replace function public.mpr_persist_catalog_batch_v1(
  p_workspace_id uuid,
  p_batch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product jsonb;
  v_identity jsonb;
  v_source jsonb;
  v_claim jsonb;
  v_run jsonb;
  v_product_id uuid;
  v_products integer := 0;
  v_identities integer := 0;
  v_sources integer := 0;
  v_claims integer := 0;
begin
  if p_workspace_id is null then
    raise exception 'WORKSPACE_ID_REQUIRED';
  end if;

  if coalesce(p_batch->>'schema','') <> 'MPR_SUPABASE_CATALOG_PERSISTENCE_BATCH_V1' then
    raise exception 'INVALID_CATALOG_BATCH_SCHEMA';
  end if;

  if coalesce((p_batch->'policy'->>'providerDataSpendEur')::numeric, -1) <> 0
     or coalesce((p_batch->'policy'->>'paidDataCallsTriggered')::integer, -1) <> 0
     or coalesce((p_batch->'policy'->>'purchaseAuthorized')::boolean, true)
     or coalesce((p_batch->'policy'->>'verifiedSalesRows')::integer, -1) <> 0
     or coalesce(p_batch->'policy'->>'salesEvidenceClass','') <> 'NOT_VERIFIED_SALES' then
    raise exception 'CATALOG_POLICY_INVARIANT_FAILED';
  end if;

  for v_product in select value from jsonb_array_elements(coalesce(p_batch->'products','[]'::jsonb)) loop
    if coalesce(v_product->>'canonicalKey','') = '' or coalesce(v_product->>'title','') = '' then
      raise exception 'PRODUCT_IDENTITY_REQUIRED';
    end if;

    insert into public.canonical_products(
      canonical_key,title,brand,category,image_url,status,evidence_confidence,priority_score,canonical_name,canonical_category,identity_status
    ) values (
      v_product->>'canonicalKey',
      v_product->>'title',
      nullif(v_product->>'brand',''),
      nullif(v_product->>'category',''),
      nullif(v_product->>'imageUrl',''),
      'DISCOVERED',0,0,
      nullif(v_product->>'title',''),
      nullif(v_product->>'category',''),
      'ACTIVE'
    )
    on conflict (canonical_key) do update set
      title = excluded.title,
      brand = coalesce(excluded.brand, public.canonical_products.brand),
      category = coalesce(excluded.category, public.canonical_products.category),
      updated_at = now()
    returning id into v_product_id;

    v_products := v_products + 1;
  end loop;

  for v_identity in select value from jsonb_array_elements(coalesce(p_batch->'identities','[]'::jsonb)) loop
    select id into v_product_id from public.canonical_products where canonical_key = v_identity->>'canonicalKey';
    if v_product_id is null then raise exception 'IDENTITY_PRODUCT_NOT_FOUND'; end if;

    insert into public.product_identity_keys_v2(workspace_id,product_id,namespace,value_norm,confidence,source_key)
    values (
      p_workspace_id,v_product_id,v_identity->>'namespace',v_identity->>'valueNorm',
      coalesce((v_identity->>'confidence')::numeric,1),nullif(v_identity->>'sourceKey','')
    )
    on conflict (workspace_id,namespace,value_norm) do update set
      product_id = excluded.product_id,
      confidence = greatest(public.product_identity_keys_v2.confidence, excluded.confidence),
      source_key = coalesce(excluded.source_key, public.product_identity_keys_v2.source_key);
    v_identities := v_identities + 1;
  end loop;

  for v_source in select value from jsonb_array_elements(coalesce(p_batch->'sourceRecords','[]'::jsonb)) loop
    select id into v_product_id from public.canonical_products where canonical_key = v_source->>'canonicalKey';
    if v_product_id is null then raise exception 'SOURCE_PRODUCT_NOT_FOUND'; end if;

    insert into public.catalog_source_records_v1(
      workspace_id,source_key,source_record_id,observed_at,product_id,evidence_class,rights_decision,identity_strength,raw_payload,content_sha256
    ) values (
      p_workspace_id,v_source->>'sourceKey',v_source->>'sourceRecordId',
      nullif(v_source->>'observedAt','')::timestamptz,v_product_id,
      coalesce(nullif(v_source->>'evidenceClass',''),'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'),
      coalesce(nullif(v_source->>'rightsDecision',''),'HOLD'),nullif(v_source->>'identityStrength',''),
      coalesce(v_source->'rawPayload','{}'::jsonb),nullif(v_source->>'contentSha256','')
    )
    on conflict (workspace_id,source_key,source_record_id) do update set
      observed_at = excluded.observed_at,
      product_id = excluded.product_id,
      evidence_class = excluded.evidence_class,
      rights_decision = excluded.rights_decision,
      identity_strength = excluded.identity_strength,
      raw_payload = excluded.raw_payload,
      content_sha256 = excluded.content_sha256;
    v_sources := v_sources + 1;
  end loop;

  for v_claim in select value from jsonb_array_elements(coalesce(p_batch->'claims','[]'::jsonb)) loop
    select id into v_product_id from public.canonical_products where canonical_key = v_claim->>'canonicalKey';
    if v_product_id is null then raise exception 'CLAIM_PRODUCT_NOT_FOUND'; end if;

    insert into public.product_claims_v1(
      product_id,source_key,source_record_id,field_name,field_value,observed_at,rights_decision,evidence_class,confidence,claim_sha256
    ) values (
      v_product_id,v_claim->>'sourceKey',v_claim->>'sourceRecordId',v_claim->>'fieldName',
      coalesce(v_claim->'fieldValue','null'::jsonb),nullif(v_claim->>'observedAt','')::timestamptz,
      coalesce(nullif(v_claim->>'rightsDecision',''),'HOLD'),
      coalesce(nullif(v_claim->>'evidenceClass',''),'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'),
      coalesce((v_claim->>'confidence')::numeric,0),v_claim->>'claimSha256'
    )
    on conflict (claim_sha256) do nothing;
    v_claims := v_claims + 1;
  end loop;

  v_run := p_batch->'ingestionRun';
  if v_run is not null then
    insert into public.bulk_ingestion_runs_v1(
      source_key,manifest_sha256,records_sha256,retrieved_at,input_count,accepted_count,held_count,logical_duplicate_count,
      silent_drop_count,checkpoint_sha256,decision,provider_data_spend_eur,paid_data_calls_triggered,purchase_authorized,
      sales_evidence_class,verified_sales_rows
    ) values (
      v_run->>'sourceKey',v_run->>'manifestSha256',v_run->>'recordsSha256',(v_run->>'retrievedAt')::timestamptz,
      coalesce((v_run->>'inputCount')::integer,0),coalesce((v_run->>'acceptedCount')::integer,0),coalesce((v_run->>'heldCount')::integer,0),
      coalesce((v_run->>'logicalDuplicateCount')::integer,0),coalesce((v_run->>'silentDropCount')::integer,0),nullif(v_run->>'checkpointSha256',''),
      coalesce(nullif(v_run->>'decision',''),'INGESTION_ACCOUNTED'),0,0,false,'NOT_VERIFIED_SALES',0
    ) on conflict (source_key,manifest_sha256) do nothing;
  end if;

  return jsonb_build_object(
    'schema','MPR_SUPABASE_CATALOG_PERSISTENCE_RECEIPT_V1',
    'productsProcessed',v_products,
    'identitiesProcessed',v_identities,
    'sourceRecordsProcessed',v_sources,
    'claimsProcessed',v_claims,
    'providerDataSpendEur',0,
    'paidDataCallsTriggered',0,
    'purchaseAuthorized',false,
    'verifiedSalesRows',0,
    'salesEvidenceClass','NOT_VERIFIED_SALES'
  );
end;
$$;

revoke all on function public.mpr_persist_catalog_batch_v1(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.mpr_persist_catalog_batch_v1(uuid,jsonb) to service_role;

commit;
