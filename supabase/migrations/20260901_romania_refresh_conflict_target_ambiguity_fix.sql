-- Fix PL/pgSQL variable/column ambiguity in the Romania refresh completion RPC.
-- Preserve the existing fail-closed, zero-cost evidence contract exactly.

create or replace function public.finish_romania_refresh_job_v1(
  p_job_id bigint,
  p_owner text,
  p_outcome text,
  p_evidence jsonb default '{}'::jsonb,
  p_error text default null,
  p_retry_after_seconds integer default 21600
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  q public.refresh_queue%rowtype;
  outcome text:=upper(coalesce(p_outcome,''));
  evidence_observed_at timestamptz;
  evidence_surface text;
  inserted_observation_id bigint;
begin
  select * into q from public.refresh_queue where id=p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if q.state<>'RUNNING' then raise exception 'JOB_NOT_RUNNING'; end if;
  if q.lease_owner is distinct from p_owner then raise exception 'LEASE_OWNER_MISMATCH'; end if;
  if q.lease_expires_at is null or q.lease_expires_at<now() then raise exception 'LEASE_EXPIRED'; end if;
  if q.target_surface not in ('EMAG_RO','TRENDYOL_RO','RO_RETAIL_WEB') then raise exception 'SURFACE_NOT_ALLOWED'; end if;

  if outcome='COMPLETED' then
    evidence_surface:=coalesce(p_evidence->>'surface','');
    if evidence_surface<>q.target_surface then raise exception 'EVIDENCE_SURFACE_MISMATCH'; end if;
    if coalesce((p_evidence->>'paidCallsTriggered')::integer,0)<>0 then raise exception 'PAID_CALLS_NOT_ALLOWED'; end if;
    if coalesce((p_evidence->>'purchaseAuthorized')::boolean,false)<>false then raise exception 'PURCHASE_NOT_ALLOWED'; end if;
    if coalesce(p_evidence->>'salesEvidenceClass','')<>'NOT_VERIFIED_SALES' then raise exception 'SALES_EVIDENCE_CLASS_INVALID'; end if;
    evidence_observed_at:=coalesce((p_evidence->>'observedAt')::timestamptz,now());

    insert into public.romania_surface_observations(
      product_id,surface,observed_at,evidence_class,freshness_class,source_url,search_query,
      product_link_lower_bound,declared_result_count_candidate,declared_result_count_trusted,
      seller_count,comparable_scope_confirmed,market_wide_competition_ready,sales_evidence_class,
      comparability_confidence,collector_version,raw_evidence
    )
    values(
      q.product_id,q.target_surface,evidence_observed_at,
      coalesce(nullif(p_evidence->>'evidenceClass',''),'DIAGNOSTIC_ONLY'),
      coalesce(nullif(p_evidence->>'freshnessClass',''),'UNKNOWN'),
      nullif(p_evidence->>'sourceUrl',''),nullif(p_evidence->>'searchQuery',''),
      nullif(p_evidence->>'productLinkLowerBound','')::integer,
      nullif(p_evidence->>'declaredResultCountCandidate','')::integer,
      coalesce((p_evidence->>'declaredResultCountTrusted')::boolean,false),
      nullif(p_evidence->>'sellerCount','')::integer,
      coalesce((p_evidence->>'comparableScopeConfirmed')::boolean,false),
      coalesce((p_evidence->>'marketWideCompetitionReady')::boolean,false),
      'NOT_VERIFIED_SALES',
      nullif(p_evidence->>'comparabilityConfidence','')::numeric,
      coalesce(nullif(p_evidence->>'collectorVersion',''),'romania-refresh-consumer-v1'),
      p_evidence
    )
    on conflict(product_id,surface,observed_at,collector_version) do nothing
    returning id into inserted_observation_id;

    update public.refresh_queue
    set state='DONE',completed_at=now(),lease_owner=null,lease_expires_at=null,last_error=null
    where id=p_job_id;
  elsif outcome in ('DEFERRED','FAILED') then
    if p_retry_after_seconds<300 or p_retry_after_seconds>604800 then raise exception 'RETRY_SECONDS_OUT_OF_RANGE'; end if;
    update public.refresh_queue
    set state='PENDING',due_at=now()+make_interval(secs=>p_retry_after_seconds),lease_owner=null,lease_expires_at=null,last_error=left(coalesce(p_error,outcome),500)
    where id=p_job_id;
  else
    raise exception 'OUTCOME_NOT_ALLOWED';
  end if;

  return jsonb_build_object(
    'ok',true,
    'jobId',p_job_id,
    'outcome',outcome,
    'surface',q.target_surface,
    'queueState',case when outcome='COMPLETED' then 'DONE' else 'PENDING' end,
    'observationId',inserted_observation_id,
    'paidCallsTriggered',0,
    'providerSpendEur',0,
    'purchaseAuthorized',false,
    'salesEvidenceClass','NOT_VERIFIED_SALES'
  );
end;
$function$;
