begin;
do $test$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  workspace_a uuid := gen_random_uuid();
  workspace_b uuid := gen_random_uuid();
  visible_rows integer;
  budget_a numeric;
  budget_b numeric;
begin
  insert into auth.users(id,email) values
    (user_a,'profile-a-'||user_a||'@example.invalid'),
    (user_b,'profile-b-'||user_b||'@example.invalid');
  insert into public.workspaces(id,name,slug,owner_id) values
    (workspace_a,'Profile test A',workspace_a::text,user_a),
    (workspace_b,'Profile test B',workspace_b::text,user_b);
  insert into public.workspace_members(workspace_id,user_id,role) values
    (workspace_a,user_a,'OWNER'),(workspace_b,user_b,'OWNER') on conflict do nothing;

  perform set_config('request.jwt.claim.sub',user_a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',user_a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  insert into public.seller_preferences(workspace_id,monthly_budget_ron) values(workspace_a,1200);
  execute 'reset role';

  perform set_config('request.jwt.claim.sub',user_b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',user_b,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into visible_rows from public.seller_preferences where workspace_id=workspace_a;
  if visible_rows<>0 then raise exception 'CROSS_WORKSPACE_PROFILE_READ_ALLOWED'; end if;
  update public.seller_preferences set monthly_budget_ron=9999 where workspace_id=workspace_a;
  get diagnostics visible_rows=row_count;
  if visible_rows<>0 then raise exception 'CROSS_WORKSPACE_PROFILE_UPDATE_ALLOWED'; end if;
  insert into public.seller_preferences(workspace_id,monthly_budget_ron) values(workspace_b,2400);
  execute 'reset role';

  select monthly_budget_ron into budget_a from public.seller_preferences where workspace_id=workspace_a;
  select monthly_budget_ron into budget_b from public.seller_preferences where workspace_id=workspace_b;
  if budget_a<>1200 or budget_b<>2400 then raise exception 'PROFILE_STATE_COLLISION'; end if;
end $test$;
rollback;
