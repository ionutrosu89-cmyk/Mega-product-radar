begin;
do $test$
declare u1 uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();w1 uuid:=gen_random_uuid();w2 uuid:=gen_random_uuid();e1 uuid:=gen_random_uuid();e2 uuid:=gen_random_uuid();r jsonb;n integer;
begin
 insert into auth.users(id,email) values(u1,'audit-'||u1||'@example.invalid'),(u2,'audit-'||u2||'@example.invalid');
 insert into public.workspaces(id,name,slug,owner_id) values(w1,'Isolation test A',w1::text,u1),(w2,'Isolation test B',w2::text,u2);
 insert into public.workspace_members(workspace_id,user_id,role) values(w1,u1,'OWNER'),(w2,u2,'OWNER') on conflict do nothing;
 insert into public.intervention_events_v1(id,workspace_id,event_type,change_summary) values(e1,w1,'test','test A'),(e2,w2,'test','test B');
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u1,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.intervention_watch_detail_v1 where id in(e1,e2);
 if n<>1 then raise exception 'CROSS_WORKSPACE_VIEW_LEAK:%',n; end if;
 perform public.record_intervention_action(e1,w1,'acknowledge','test',null);
 begin perform public.record_intervention_action(e2,w1,'resolve','test',null);raise exception 'CROSS_WORKSPACE_ACTION_ALLOWED'; exception when insufficient_privilege then null; end;
 begin perform public.mpr_sync_intervention_watch(w2,1,1);raise exception 'CROSS_WORKSPACE_SYNC_ALLOWED'; exception when insufficient_privilege then null; end;
 begin update public.intervention_events_v1 set status='resolved' where id=e1;raise exception 'DIRECT_WRITE_ALLOWED'; exception when insufficient_privilege then null; end;
 r:=public.mpr_sync_intervention_watch(w1,1,1);
 if r->>'status'<>'completed' then raise exception 'SYNC_FAILED:%',r;end if;
 execute 'reset role';
 if has_function_privilege('anon','public.mpr_sync_intervention_watch(uuid,integer,integer)','execute') then raise exception 'ANON_SYNC_ALLOWED';end if;
 if has_function_privilege('authenticated','public.mpr_sync_all_workspaces(integer,integer)','execute') then raise exception 'GLOBAL_SYNC_ALLOWED';end if;
end $test$;
rollback;
