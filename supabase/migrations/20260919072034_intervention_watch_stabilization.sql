-- Reconstruct existing Intervention Watch objects and secure workspace boundaries.
create table if not exists public.intervention_events_v1 (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null,
  source_table text,
  source_record_id uuid,
  canonical_key text,
  product_id uuid,
  title text,
  category text,
  event_type text not null,
  severity text not null default 'watch'::text,
  status text not null default 'open'::text,
  previous_value jsonb,
  current_value jsonb,
  change_summary text not null,
  impact_summary text,
  recommended_action text,
  evidence jsonb not null default '[]'::jsonb,
  detected_at timestamp with time zone not null default now(),
  acknowledged_at timestamp with time zone,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  snoozed_until timestamp with time zone
);
create table if not exists public.intervention_actions_v1 (
  id uuid not null default gen_random_uuid(),
  intervention_id uuid not null,
  workspace_id uuid not null,
  action_type text not null,
  action_text text not null,
  status text not null default 'pending'::text,
  operator_id uuid,
  notes text,
  executed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);
create table if not exists public.intervention_watch_snapshots_v1 (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null,
  product_id uuid not null,
  canonical_key text not null,
  fingerprint text not null,
  state jsonb not null,
  observed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists public.intervention_watch_runs_v1 (
  id uuid not null default gen_random_uuid(),
  workspace_id uuid not null,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  lookback_hours integer not null default 24,
  candidate_limit integer not null default 100,
  baselined integer not null default 0,
  candidates integer not null default 0,
  interventions_created integer not null default 0,
  status text not null default 'running'::text,
  error_message text,
  created_at timestamp with time zone not null default now()
);
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_actions_status_ck' and conrelid='public.intervention_actions_v1'::regclass) then alter table public.intervention_actions_v1 add constraint intervention_actions_status_ck CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'skipped'::text, 'failed'::text]))); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_actions_v1_intervention_id_fkey' and conrelid='public.intervention_actions_v1'::regclass) then alter table public.intervention_actions_v1 add constraint intervention_actions_v1_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES intervention_events_v1(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_actions_v1_pkey' and conrelid='public.intervention_actions_v1'::regclass) then alter table public.intervention_actions_v1 add constraint intervention_actions_v1_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_actions_v1_workspace_id_fkey' and conrelid='public.intervention_actions_v1'::regclass) then alter table public.intervention_actions_v1 add constraint intervention_actions_v1_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_events_severity_ck' and conrelid='public.intervention_events_v1'::regclass) then alter table public.intervention_events_v1 add constraint intervention_events_severity_ck CHECK ((severity = ANY (ARRAY['monitor'::text, 'watch'::text, 'review'::text, 'intervention'::text]))); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_events_status_ck' and conrelid='public.intervention_events_v1'::regclass) then alter table public.intervention_events_v1 add constraint intervention_events_status_ck CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'in_progress'::text, 'resolved'::text, 'ignored'::text, 'snoozed'::text]))); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_events_v1_pkey' and conrelid='public.intervention_events_v1'::regclass) then alter table public.intervention_events_v1 add constraint intervention_events_v1_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_events_v1_workspace_id_fkey' and conrelid='public.intervention_events_v1'::regclass) then alter table public.intervention_events_v1 add constraint intervention_events_v1_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_watch_runs_v1_pkey' and conrelid='public.intervention_watch_runs_v1'::regclass) then alter table public.intervention_watch_runs_v1 add constraint intervention_watch_runs_v1_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_watch_runs_v1_workspace_id_fkey' and conrelid='public.intervention_watch_runs_v1'::regclass) then alter table public.intervention_watch_runs_v1 add constraint intervention_watch_runs_v1_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_watch_snapshots_v1_pkey' and conrelid='public.intervention_watch_snapshots_v1'::regclass) then alter table public.intervention_watch_snapshots_v1 add constraint intervention_watch_snapshots_v1_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists(select 1 from pg_constraint where conname='intervention_watch_snapshots_v1_workspace_id_product_id_key' and conrelid='public.intervention_watch_snapshots_v1'::regclass) then alter table public.intervention_watch_snapshots_v1 add constraint intervention_watch_snapshots_v1_workspace_id_product_id_key UNIQUE (workspace_id, product_id); end if; end $$;
alter table public.intervention_events_v1 enable row level security;
revoke all on public.intervention_events_v1 from public, anon, authenticated;
grant select on public.intervention_events_v1 to authenticated;
grant all on public.intervention_events_v1 to service_role;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename='intervention_events_v1' loop execute format('drop policy %I on public.intervention_events_v1',r.policyname); end loop; end $$;
create policy intervention_events_v1_read on public.intervention_events_v1 for select to authenticated using (public.is_workspace_member(workspace_id));
alter table public.intervention_actions_v1 enable row level security;
revoke all on public.intervention_actions_v1 from public, anon, authenticated;
grant select on public.intervention_actions_v1 to authenticated;
grant all on public.intervention_actions_v1 to service_role;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename='intervention_actions_v1' loop execute format('drop policy %I on public.intervention_actions_v1',r.policyname); end loop; end $$;
create policy intervention_actions_v1_read on public.intervention_actions_v1 for select to authenticated using (public.is_workspace_member(workspace_id));
alter table public.intervention_watch_snapshots_v1 enable row level security;
revoke all on public.intervention_watch_snapshots_v1 from public, anon, authenticated;
grant select on public.intervention_watch_snapshots_v1 to authenticated;
grant all on public.intervention_watch_snapshots_v1 to service_role;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename='intervention_watch_snapshots_v1' loop execute format('drop policy %I on public.intervention_watch_snapshots_v1',r.policyname); end loop; end $$;
create policy intervention_watch_snapshots_v1_read on public.intervention_watch_snapshots_v1 for select to authenticated using (public.is_workspace_member(workspace_id));
alter table public.intervention_watch_runs_v1 enable row level security;
revoke all on public.intervention_watch_runs_v1 from public, anon, authenticated;
grant select on public.intervention_watch_runs_v1 to authenticated;
grant all on public.intervention_watch_runs_v1 to service_role;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename='intervention_watch_runs_v1' loop execute format('drop policy %I on public.intervention_watch_runs_v1',r.policyname); end loop; end $$;
create policy intervention_watch_runs_v1_read on public.intervention_watch_runs_v1 for select to authenticated using (public.is_workspace_member(workspace_id));
create index if not exists intervention_events_workspace_detected_idx on public.intervention_events_v1(workspace_id,detected_at desc);
create index if not exists intervention_actions_workspace_event_idx on public.intervention_actions_v1(workspace_id,intervention_id);
create index if not exists intervention_runs_workspace_started_idx on public.intervention_watch_runs_v1(workspace_id,started_at desc);
create or replace view public.intervention_watch_detail_v1 with (security_invoker=true) as
 SELECT e.id,
    e.workspace_id,
    e.source_table,
    e.source_record_id,
    e.canonical_key,
    e.product_id,
    e.title,
    e.category,
    e.event_type,
    e.severity,
    e.status,
    e.previous_value,
    e.current_value,
    e.change_summary,
    e.impact_summary,
    e.recommended_action,
    e.evidence,
    e.detected_at,
    e.acknowledged_at,
    e.resolved_at,
    e.created_at,
    e.updated_at,
    e.snoozed_until,
    jsonb_agg(to_jsonb(a.*) ORDER BY (COALESCE(a.executed_at, a.created_at)) DESC) FILTER (WHERE a.id IS NOT NULL) AS audit_trail
   FROM intervention_events_v1 e
     LEFT JOIN intervention_actions_v1 a ON a.intervention_id = e.id AND a.workspace_id = e.workspace_id
  GROUP BY e.id;
revoke all on public.intervention_watch_detail_v1 from public,anon,authenticated;
grant select on public.intervention_watch_detail_v1 to authenticated;
-- Only RPCs may mutate the audit trail. Membership is checked before every privileged write.
create or replace function public.record_intervention_action(p_intervention_id uuid,p_workspace_id uuid,p_action_type text,p_action_text text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare action_id uuid; new_status text;
begin
 if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then raise exception 'WORKSPACE_ACCESS_DENIED' using errcode='42501'; end if;
 if p_action_type is null or p_action_type not in('acknowledge','resolve','ignore','snooze','escalate','note') then raise exception 'INVALID_ACTION' using errcode='22023'; end if;
 perform 1 from public.intervention_events_v1 where id=p_intervention_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'INTERVENTION_NOT_FOUND' using errcode='42501'; end if;
 new_status:=case p_action_type when 'acknowledge' then 'acknowledged' when 'resolve' then 'resolved' when 'ignore' then 'ignored' when 'snooze' then 'snoozed' end;
 insert into public.intervention_actions_v1(intervention_id,workspace_id,action_type,action_text,status,operator_id,notes,executed_at)
 values(p_intervention_id,p_workspace_id,p_action_type,left(coalesce(p_action_text,'Intervention action'),2000),'completed',auth.uid(),left(p_notes,4000),now()) returning id into action_id;
 update public.intervention_events_v1 set status=coalesce(new_status,status),
 snoozed_until=case when p_action_type='snooze' then now()+interval '24 hours' when new_status is not null then null else snoozed_until end,
 acknowledged_at=case when p_action_type='acknowledge' then coalesce(acknowledged_at,now()) else acknowledged_at end,
 resolved_at=case when p_action_type in('resolve','ignore') then now() when new_status is not null then null else resolved_at end,
 severity=case when p_action_type='escalate' then 'intervention' else severity end,updated_at=now()
 where id=p_intervention_id and workspace_id=p_workspace_id;
 return action_id;
end $$;
revoke all on function public.record_intervention_action(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.record_intervention_action(uuid,uuid,text,text,text) to authenticated;

create or replace function public.resolve_intervention_event(p_event_id uuid,p_note text default null)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare wid uuid;
begin
 select workspace_id into wid from public.intervention_events_v1 where id=p_event_id;
 if wid is null then raise exception 'INTERVENTION_NOT_FOUND' using errcode='42501'; end if;
 perform public.record_intervention_action(p_event_id,wid,'resolve','Intervention marked resolved',p_note);
end $$;
revoke all on function public.resolve_intervention_event(uuid,text) from public,anon;
grant execute on function public.resolve_intervention_event(uuid,text) to authenticated;

create or replace function public.mpr_sync_intervention_watch(p_workspace_id uuid,p_lookback_hours integer default 48,p_limit integer default 250)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r record; old_state jsonb; changed text[]; v_candidates integer:=0; v_baselined integer:=0; v_changed integer:=0; run_id uuid; existing_id uuid; sev text;
begin
 if not (coalesce(auth.role(),'')='service_role' or (session_user='postgres' and current_setting('role')='none')) and (auth.uid() is null or not public.is_workspace_member(p_workspace_id)) then raise exception 'WORKSPACE_ACCESS_DENIED' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 1000 or p_lookback_hours is null or p_lookback_hours not between 1 and 720 then raise exception 'INVALID_SYNC_BOUNDS' using errcode='22023'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('mpr-interventions:'||p_workspace_id::text,0)) then return jsonb_build_object('status','busy','interventions_created',0); end if;
 insert into public.intervention_watch_runs_v1(workspace_id,lookback_hours,candidate_limit) values(p_workspace_id,p_lookback_hours,p_limit) returning id into run_id;
 begin
 for r in
 with recent as (
 select product_id,max(observed_at) at from public.product_observations where observed_at>=now()-make_interval(hours=>p_lookback_hours) and observed_at<=now() group by product_id
 union all select product_id,max(observed_at) from public.romania_surface_observations where observed_at>=now()-make_interval(hours=>p_lookback_hours) and observed_at<=now() group by product_id
 ), ids as(select product_id,max(at) at from recent group by product_id order by max(at) desc limit p_limit)
 select p.id product_id,coalesce(to_jsonb(p)->>'canonical_key',p.id::text) canonical_key,
 coalesce(to_jsonb(p)->>'title',to_jsonb(p)->>'canonical_name',p.id::text) title,
 coalesce(to_jsonb(p)->>'category',to_jsonb(p)->>'canonical_category') category,
 coalesce(o.state,'{}'::jsonb)||jsonb_build_object('romania_surfaces_current',ro.surfaces,'latest_ro_observed_at',ro.at) state
 from ids join public.canonical_products p on p.id=ids.product_id
 left join lateral (
 select jsonb_object_agg(observation_type,jsonb_build_object('value',numeric_value,'currency',currency,'source',source_key,'observedAt',observed_at)) state from(
 select distinct on(observation_type) observation_type,numeric_value,currency,source_key,observed_at
 from public.product_observations where product_id=p.id and observed_at<=now() and observation_type in('review_count','rating','marketplace_listing_price')
 order by observation_type,observed_at desc,id desc)x
 )o on true
 left join lateral(select count(distinct surface) filter(where observed_at>=now()-interval '90 days') surfaces,max(observed_at) at from public.romania_surface_observations where product_id=p.id and observed_at<=now())ro on true
 loop
  v_candidates:=v_candidates+1;old_state:=null;existing_id:=null;
  select state into old_state from public.intervention_watch_snapshots_v1 where workspace_id=p_workspace_id and product_id=r.product_id;
  -- Legacy snapshots used a different shape; baseline once without fabricating a change.
  if old_state is null or (not old_state ? 'marketplace_listing_price' and old_state ? 'price') then v_baselined:=v_baselined+1;
  else
   changed:=array_remove(array[
   case when old_state#>'{marketplace_listing_price,value}' is distinct from r.state#>'{marketplace_listing_price,value}' or old_state#>'{marketplace_listing_price,currency}' is distinct from r.state#>'{marketplace_listing_price,currency}' then 'price' end,
   case when old_state#>'{review_count,value}' is distinct from r.state#>'{review_count,value}' then 'review count' end,
   case when old_state#>'{rating,value}' is distinct from r.state#>'{rating,value}' then 'rating' end,
   case when old_state->>'romania_surfaces_current' is distinct from r.state->>'romania_surfaces_current' then 'Romania surfaces' end],null);
   if cardinality(changed)>0 then
    sev:=case when 'price'=any(changed) then 'intervention' when 'Romania surfaces'=any(changed) then 'review' else 'watch' end;
    select id into existing_id from public.intervention_events_v1 where workspace_id=p_workspace_id and product_id=r.product_id and event_type='observation_change' and status not in('resolved','ignored') order by detected_at desc limit 1;
    if existing_id is null then
     insert into public.intervention_events_v1(workspace_id,product_id,canonical_key,title,category,source_table,source_record_id,event_type,severity,previous_value,current_value,change_summary,impact_summary,recommended_action,evidence)
     values(p_workspace_id,r.product_id,r.canonical_key,r.title,r.category,'product_observations',r.product_id,'observation_change',sev,old_state,r.state,'Changed: '||array_to_string(changed,', '),'Evidence changed; commercial readiness must be reviewed.','Review the source and recalculate the decision before acting.',jsonb_build_object('source','public observations','salesEvidenceClass','NOT_VERIFIED_SALES'));
     v_changed:=v_changed+1;
    else
     update public.intervention_events_v1 set current_value=r.state,change_summary='Changed: '||array_to_string(changed,', '),severity=sev,updated_at=now() where id=existing_id and workspace_id=p_workspace_id;
    end if;
   end if;
  end if;
  insert into public.intervention_watch_snapshots_v1(workspace_id,product_id,canonical_key,fingerprint,state,observed_at)
  values(p_workspace_id,r.product_id,r.canonical_key,md5(r.state::text),r.state,now())
  on conflict(workspace_id,product_id) do update set canonical_key=excluded.canonical_key,fingerprint=excluded.fingerprint,state=excluded.state,observed_at=excluded.observed_at,updated_at=now();
 end loop;
 update public.intervention_watch_runs_v1 set status='completed',finished_at=now(),candidates=v_candidates,baselined=v_baselined,interventions_created=v_changed where id=run_id;
 return jsonb_build_object('status','completed','candidates',v_candidates,'baselined',v_baselined,'interventions_created',v_changed);
 exception when others then
 update public.intervention_watch_runs_v1 set status='failed',finished_at=now(),error_message='SYNC_FAILED:'||sqlstate where id=run_id;
 return jsonb_build_object('status','failed','code','SYNC_FAILED','interventions_created',0);
 end;
end $$;
revoke all on function public.mpr_sync_intervention_watch(uuid,integer,integer) from public,anon;
grant execute on function public.mpr_sync_intervention_watch(uuid,integer,integer) to authenticated;
create or replace function public.mpr_sync_all_workspaces(p_lookback_hours integer default 24,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare w record; r jsonb; n integer:=0; errors integer:=0;
begin
 if not (coalesce(auth.role(),'')='service_role' or (session_user='postgres' and current_setting('role')='none')) then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 for w in select id from public.workspaces loop
 r:=public.mpr_sync_intervention_watch(w.id,p_lookback_hours,p_limit);n:=n+1;
 if r->>'status'='failed' then errors:=errors+1; end if;
 end loop;
 return jsonb_build_object('workspaces',n,'errors',errors);
end $$;
revoke all on function public.mpr_sync_all_workspaces(integer,integer) from public,anon,authenticated;
grant execute on function public.mpr_sync_all_workspaces(integer,integer) to service_role;
grant execute on function public.mpr_sync_intervention_watch(uuid,integer,integer) to service_role;
