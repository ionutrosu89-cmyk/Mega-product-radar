begin;
do $test$
declare u1 uuid:=gen_random_uuid();u2 uuid:=gen_random_uuid();w1 uuid:=gen_random_uuid();w2 uuid:=gen_random_uuid();n integer;v text;
begin
 insert into auth.users(id,email) values(u1,'test-'||u1||'@example.invalid'),(u2,'test-'||u2||'@example.invalid');
 insert into public.workspaces(id,name,slug,owner_id) values(w1,'Test A',w1::text,u1),(w2,'Test B',w2::text,u2);
 insert into public.workspace_members(workspace_id,user_id,role) values(w1,u1,'OWNER'),(w2,u2,'OWNER') on conflict do nothing;
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u1,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 insert into public.commercial_watchlist(workspace_id,user_id,product_key,product_name) values(w1,u1,'synthetic-product','Synthetic fixture');
 update public.commercial_watchlist set state='VALIDATING' where workspace_id=w1 and product_key='synthetic-product';
 begin
  insert into public.commercial_watchlist(workspace_id,user_id,product_key,product_name) values(w2,u1,'forbidden','Forbidden fixture');
  raise exception 'CROSS_WORKSPACE_INSERT_ALLOWED';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',u2::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u2,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.commercial_watchlist where workspace_id=w1;
 if n<>0 then raise exception 'CROSS_WORKSPACE_READ_ALLOWED';end if;
 update public.commercial_watchlist set state='PAUSED' where workspace_id=w1;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'CROSS_WORKSPACE_UPDATE_ALLOWED';end if;
 insert into public.commercial_watchlist(workspace_id,user_id,product_key,product_name) values(w2,u2,'synthetic-product','Independent fixture');
 execute 'reset role';
 select state into v from public.commercial_watchlist where workspace_id=w1 and product_key='synthetic-product';
 if v<>'VALIDATING' then raise exception 'ORIGINAL_ACTION_LOST';end if;
 select state into v from public.commercial_watchlist where workspace_id=w2 and product_key='synthetic-product';
 if v<>'WATCHING' then raise exception 'WORKSPACE_STATE_COLLISION';end if;
end $test$;
rollback;
