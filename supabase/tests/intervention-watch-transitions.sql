-- Transactional fixtures: no production observations or workspace data persist.
begin;
do $test$
declare u uuid:=gen_random_uuid();w uuid:=gen_random_uuid();p uuid;s text;r jsonb;n integer;
begin
 p:=gen_random_uuid();s:='transactional-test-'||p;
 insert into public.data_sources(source_key,provider,collection_method) values(s,'TEST_ONLY','TRANSACTIONAL_FIXTURE');
 insert into public.canonical_products(id,canonical_key,title) values(p,s,'Transactional fixture, not a real product');
 insert into auth.users(id,email) values(u,'audit-'||u||'@example.invalid');
 insert into public.workspaces(id,name,slug,owner_id) values(w,'Transactional sync test',w::text,u);
 insert into public.workspace_members(workspace_id,user_id,role) values(w,u,'OWNER') on conflict do nothing;
 insert into public.product_observations(product_id,source_key,observation_type,numeric_value,currency,observed_at) values(p,s,'marketplace_listing_price',10,'EUR',now()-interval '2 seconds');
 r:=public.mpr_sync_intervention_watch(w,1,1000);
 if r->>'status'<>'completed' then raise exception 'BASELINE_FAILED:%',r;end if;
 if not exists(select 1 from public.intervention_watch_snapshots_v1 where workspace_id=w and product_id=p) then raise exception 'BASELINE_MISSING';end if;
 insert into public.product_observations(product_id,source_key,observation_type,numeric_value,currency,observed_at) values(p,s,'marketplace_listing_price',11,'EUR',now()-interval '1 second');
 r:=public.mpr_sync_intervention_watch(w,1,1000);
 select count(*) into n from public.intervention_events_v1 where workspace_id=w and product_id=p and severity='intervention';
 if r->>'status'<>'completed' or n<>1 then raise exception 'PRICE_CHANGE_NOT_RECORDED:%/%',r,n;end if;
 insert into public.product_observations(product_id,source_key,observation_type,numeric_value,currency,observed_at) values(p,s,'marketplace_listing_price',11,'EUR',now());
 r:=public.mpr_sync_intervention_watch(w,1,1000);
 if r->>'status'<>'completed' or (r->>'interventions_created')::int<>0 then raise exception 'TIMESTAMP_ONLY_CHANGE_CREATED_EVENT:%',r;end if;
 select count(*) into n from public.intervention_events_v1 where workspace_id=w and product_id=p;
 if n<>1 then raise exception 'DUPLICATE_EVENT:%',n;end if;
end $test$;
rollback;
