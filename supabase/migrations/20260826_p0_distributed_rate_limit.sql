-- P0 distributed API rate limiting.
-- Service-role RPC provides an atomic shared limiter across serverless instances.

create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from anon, authenticated;

create or replace function public.consume_api_rate_limit(p_bucket_key text,p_limit integer,p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.api_rate_limit_buckets;
  cutoff timestamptz := now() - make_interval(secs => greatest(1,p_window_seconds));
  safe_limit integer := greatest(1,p_limit);
begin
  if p_bucket_key is null or btrim(p_bucket_key)='' then raise exception 'bucket key required'; end if;
  insert into public.api_rate_limit_buckets(bucket_key,window_started_at,hit_count,updated_at)
  values(p_bucket_key,now(),1,now())
  on conflict(bucket_key) do update set
    window_started_at=case when public.api_rate_limit_buckets.window_started_at < cutoff then now() else public.api_rate_limit_buckets.window_started_at end,
    hit_count=case when public.api_rate_limit_buckets.window_started_at < cutoff then 1 else public.api_rate_limit_buckets.hit_count+1 end,
    updated_at=now()
  returning * into r;
  return jsonb_build_object(
    'allowed',r.hit_count<=safe_limit,
    'hitCount',r.hit_count,
    'limit',safe_limit,
    'windowStartedAt',r.window_started_at,
    'retryAfterSeconds',case when r.hit_count<=safe_limit then 0 else greatest(1,ceil(extract(epoch from ((r.window_started_at+make_interval(secs=>greatest(1,p_window_seconds)))-now())))::integer) end
  );
end;
$$;
revoke execute on function public.consume_api_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;
