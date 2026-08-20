-- Mega Product Radar commercial plan migration
-- Keeps legacy plan values readable while enabling the new funnel.

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces alter column plan set default 'FREE';
alter table public.workspaces add constraint workspaces_plan_check
  check (plan in ('FREE','DISCOVER','RADAR','LAUNCH','STARTER','PRO','BUSINESS'));

alter table public.subscriptions alter column plan set default 'FREE';

create or replace function public.create_personal_workspace(workspace_name text, workspace_slug text)
returns public.workspaces language plpgsql security definer set search_path=public as $$
declare w public.workspaces;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workspaces(name,slug,owner_id,plan)
  values(workspace_name, workspace_slug || '-' || substr(auth.uid()::text,1,8), auth.uid(), 'FREE')
  returning * into w;
  insert into public.workspace_members(workspace_id,user_id,role) values(w.id,auth.uid(),'OWNER');
  insert into public.subscriptions(workspace_id,plan,status) values(w.id,'FREE','FOUNDATION');
  return w;
end;$$;

revoke execute on function public.create_personal_workspace(text,text) from public, anon;
grant execute on function public.create_personal_workspace(text,text) to authenticated;
