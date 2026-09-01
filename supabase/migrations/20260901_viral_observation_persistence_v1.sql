begin;

create or replace function public.persist_viral_observation_v1(p_observation jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_source public.viral_discovery_sources_v1%rowtype;
  v_concept_id uuid;
  v_observation_id bigint;
  v_inserted boolean := false;
begin
  if coalesce(p_observation->>'platform','')='' or coalesce(p_observation->>'externalId','')='' or coalesce(p_observation->>'canonicalKey','')='' then
    raise exception 'VIRAL_OBSERVATION_IDENTITY_REQUIRED';
  end if;
  if coalesce(p_observation->>'sourceUrl','') !~ '^https://' or nullif(p_observation->>'observedAt','') is null then
    raise exception 'VIRAL_OBSERVATION_PROVENANCE_REQUIRED';
  end if;
  if coalesce((p_observation->>'purchaseAuthorized')::boolean,true) or coalesce((p_observation->>'providerDataSpendEur')::numeric,-1)<>0 then
    raise exception 'VIRAL_OBSERVATION_POLICY_INVARIANT_FAILED';
  end if;

  select * into v_source from public.viral_discovery_sources_v1
  where platform=p_observation->>'platform' and enabled=true and terms_review_status='APPROVED'
  order by id limit 1;
  if v_source.id is null then raise exception 'VIRAL_SOURCE_NOT_APPROVED_OR_ENABLED'; end if;
  if coalesce(p_observation->>'brandPolicyClass','UNKNOWN_REVIEW')='ESTABLISHED_EXCLUDE' then raise exception 'STOP_BRAND_GATE'; end if;
  if coalesce(p_observation->>'evidenceClass','UNVERIFIED')='UNVERIFIED' then raise exception 'UNVERIFIED_VIRAL_EVIDENCE_REJECTED'; end if;

  insert into public.viral_product_concepts_v1(canonical_key,concept_name,category,detected_brand,brand_policy_class,generic_search_terms)
  values (p_observation->>'canonicalKey',p_observation->>'conceptName',nullif(p_observation->>'category',''),nullif(p_observation->>'detectedBrand',''),coalesce(p_observation->>'brandPolicyClass','UNKNOWN_REVIEW'),array[p_observation->>'conceptName'])
  on conflict (canonical_key) do update set
    category=coalesce(excluded.category,public.viral_product_concepts_v1.category),
    detected_brand=coalesce(excluded.detected_brand,public.viral_product_concepts_v1.detected_brand),
    updated_at=now()
  returning id into v_concept_id;

  insert into public.viral_observations_v1(concept_id,source_id,external_id,country_code,observed_at,source_url,title,view_count,engagement_count,active_ad_count,search_interest,marketplace_rank,review_count,evidence_class,raw_payload)
  values (v_concept_id,v_source.id,p_observation->>'externalId',p_observation->>'countryCode',(p_observation->>'observedAt')::timestamptz,p_observation->>'sourceUrl',nullif(p_observation->>'title',''),nullif(p_observation->'metrics'->>'viewCount','')::bigint,nullif(p_observation->'metrics'->>'engagementCount','')::bigint,nullif(p_observation->'metrics'->>'activeAdCount','')::integer,nullif(p_observation->'metrics'->>'searchInterest','')::numeric,nullif(p_observation->'metrics'->>'marketplaceRank','')::integer,nullif(p_observation->'metrics'->>'reviewCount','')::integer,p_observation->>'evidenceClass',coalesce(p_observation->'metrics','{}'::jsonb))
  on conflict (source_id,external_id,country_code,observed_at) do nothing
  returning id into v_observation_id;
  v_inserted := v_observation_id is not null;
  if not v_inserted then
    select id into v_observation_id from public.viral_observations_v1 where source_id=v_source.id and external_id=p_observation->>'externalId' and country_code=p_observation->>'countryCode' and observed_at=(p_observation->>'observedAt')::timestamptz;
  end if;

  return jsonb_build_object('schema','MPR_VIRAL_OBSERVATION_RECEIPT_V1','conceptId',v_concept_id,'observationId',v_observation_id,'inserted',v_inserted,'providerDataSpendEur',0,'purchaseAuthorized',false,'claimsSales',false);
end;
$$;

revoke all on function public.persist_viral_observation_v1(jsonb) from public,anon,authenticated;
grant execute on function public.persist_viral_observation_v1(jsonb) to service_role;

commit;
