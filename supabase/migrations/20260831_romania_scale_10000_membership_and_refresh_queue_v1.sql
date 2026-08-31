create table if not exists public.romania_scale_10000_membership_v1 (
  product_id uuid primary key references public.canonical_products(id) on delete cascade,
  selection_rank integer not null unique,
  amazon_asin text not null unique,
  target_set text not null default 'AMAZON_CANONICAL_10K_PRE_100K',
  created_at timestamptz not null default now(),
  check (selection_rank between 1 and 10000),
  check (amazon_asin ~ '^[A-Z0-9]{10}$')
);
insert into public.romania_scale_10000_membership_v1(product_id,selection_rank,amazon_asin)
select product_id, selection_rank, external_id from (
  select pa.product_id,pa.external_id,row_number() over(order by pa.external_id)::integer selection_rank
  from public.product_aliases pa where pa.platform='AMAZON'
) s where selection_rank<=10000
on conflict(product_id) do update set selection_rank=excluded.selection_rank,amazon_asin=excluded.amazon_asin;
do $$ declare c integer; d integer; begin
 select count(*),count(distinct amazon_asin) into c,d from public.romania_scale_10000_membership_v1;
 if c<>10000 or d<>10000 then raise exception 'ROMANIA_10K_MEMBERSHIP_COUNT_REJECTED count=% distinct=%',c,d; end if;
end $$;
insert into public.refresh_queue(product_id,tier,reason,due_at,estimated_cost_eur,information_value,state,target_surface,evidence_kind,priority_score,shard_key,dedupe_key,provider_policy)
select m.product_id,case when m.selection_rank<=100 then 'HOT' else 'ACTIVE' end,'ROMANIA_10K_HYDRATION_EMAG_V1',now(),0,
 case when m.selection_rank<=100 then 999 else least(998,greatest(1,10000-m.selection_rank)) end,'PENDING','EMAG_RO','ROMANIA_MARKET_EVIDENCE',
 case when m.selection_rank<=100 then 999 else least(998,greatest(1,10000-m.selection_rank)) end,
 'romania10k:'||lpad(((m.selection_rank-1)%100)::text,2,'0'),'romania10k:EMAG_RO:'||m.amazon_asin,
 jsonb_build_object('benchmark_status','ACTIVE','paid_calls_allowed',false,'purchase_authorized',false,'target_set','AMAZON_CANONICAL_10K_PRE_100K','selection_rank',m.selection_rank)
from public.romania_scale_10000_membership_v1 m
where not exists(select 1 from public.refresh_queue q where q.product_id=m.product_id and q.target_surface='EMAG_RO' and q.evidence_kind='ROMANIA_MARKET_EVIDENCE' and q.state in('PENDING','RUNNING','DONE'));
insert into public.refresh_queue(product_id,tier,reason,due_at,estimated_cost_eur,information_value,state,target_surface,evidence_kind,priority_score,shard_key,dedupe_key,provider_policy)
select m.product_id,'LONG_TAIL','ROMANIA_10K_HYDRATION_SECONDARY_V1',now()+interval '7 days',0,1,'PENDING',s.surface,'ROMANIA_MARKET_EVIDENCE',1,
 'romania10k:'||lpad(((m.selection_rank-1)%100)::text,2,'0'),'romania10k:'||s.surface||':'||m.amazon_asin,
 jsonb_build_object('benchmark_status','ACTIVE','paid_calls_allowed',false,'purchase_authorized',false,'adapter_status','PENDING_VALIDATION','target_set','AMAZON_CANONICAL_10K_PRE_100K','selection_rank',m.selection_rank)
from public.romania_scale_10000_membership_v1 m cross join(values('TRENDYOL_RO'),('RO_RETAIL_WEB'))s(surface)
where not exists(select 1 from public.refresh_queue q where q.product_id=m.product_id and q.target_surface=s.surface and q.evidence_kind='ROMANIA_MARKET_EVIDENCE' and q.state in('PENDING','RUNNING','DONE'));
create index if not exists romania_scale_10000_rank_idx on public.romania_scale_10000_membership_v1(selection_rank);
create index if not exists romania_scale_10000_asin_idx on public.romania_scale_10000_membership_v1(amazon_asin);
