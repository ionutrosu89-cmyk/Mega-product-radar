begin;

create or replace function public.refresh_viral_candidate_scores_v1()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer:=0;
begin
  with ordered as (
    select o.*,s.platform,
      row_number() over(partition by o.concept_id,s.platform order by o.observed_at,o.id) as rn_first,
      row_number() over(partition by o.concept_id,s.platform order by o.observed_at desc,o.id desc) as rn_last
    from public.viral_observations_v1 o join public.viral_discovery_sources_v1 s on s.id=o.source_id
    where o.evidence_class<>'UNVERIFIED'
  ), facts as (
    select concept_id,count(*)::integer observation_count,count(distinct platform)::integer platform_count,
      count(distinct country_code) filter(where country_code<>'RO')::integer foreign_country_count,
      max(view_count) filter(where platform='TIKTOK' and rn_last=1) tt_last,max(view_count) filter(where platform='TIKTOK' and rn_first=1) tt_first,
      max(active_ad_count) filter(where platform='META' and rn_last=1) meta_last,max(active_ad_count) filter(where platform='META' and rn_first=1) meta_first,
      max(search_interest) filter(where platform='GOOGLE_TRENDS' and rn_last=1) google_last,max(search_interest) filter(where platform='GOOGLE_TRENDS' and rn_first=1) google_first,
      max(marketplace_rank) filter(where platform='AMAZON' and rn_first=1) amazon_first,max(marketplace_rank) filter(where platform='AMAZON' and rn_last=1) amazon_last
    from ordered group by concept_id
  ), components as (
    select f.*,
      least(100,greatest(0,case when tt_first>0 then round((tt_last-tt_first)::numeric/tt_first*100) else 0 end)) as tiktok_score,
      least(100,greatest(0,case when meta_first>0 then round((meta_last-meta_first)::numeric/meta_first*100) else 0 end)) as meta_score,
      least(100,greatest(0,case when google_first>0 then round((google_last-google_first)::numeric/google_first*100) else 0 end)) as google_score,
      least(100,greatest(0,case when amazon_first>0 and amazon_last is not null then round((amazon_first-amazon_last)::numeric/amazon_first*100) else 0 end)) as amazon_score,
      least(100,round(f.foreign_country_count::numeric/5*100)) as country_score
    from facts f
  ), scored as (
    select c.*,(c.tiktok_score*.25+c.meta_score*.15+c.google_score*.20+c.amazon_score*.15+c.country_score*.10) as score_without_ro
    from components c
  )
  insert into public.viral_candidate_scores_v1(concept_id,computed_at,observation_count,platform_count,foreign_country_count,tiktok_velocity_score,meta_ad_momentum_score,google_acceleration_score,amazon_demand_score,romania_scarcity_score,viral_score,lifecycle,romania_evidence_class,score_inputs)
  select s.concept_id,now(),s.observation_count,s.platform_count,s.foreign_country_count,s.tiktok_score,s.meta_score,s.google_score,s.amazon_score,0,
    round(s.score_without_ro),
    case when c.brand_policy_class='ESTABLISHED_EXCLUDE' or s.observation_count<2 or s.platform_count<2 then 'UNVERIFIED'
      when s.score_without_ro>=80 then 'VIRAL' when s.score_without_ro>=60 then 'ACCELERATING' when s.score_without_ro>=35 then 'EARLY' else 'WATCH' end,
    'UNVERIFIED',jsonb_build_object('countrySpreadScore',s.country_score,'romaniaMissingAsScarcity',false,'claimsSales',false)
  from scored s join public.viral_product_concepts_v1 c on c.id=s.concept_id
  on conflict(concept_id) do update set
    computed_at=excluded.computed_at,observation_count=excluded.observation_count,platform_count=excluded.platform_count,foreign_country_count=excluded.foreign_country_count,
    tiktok_velocity_score=excluded.tiktok_velocity_score,meta_ad_momentum_score=excluded.meta_ad_momentum_score,google_acceleration_score=excluded.google_acceleration_score,amazon_demand_score=excluded.amazon_demand_score,
    viral_score=round(excluded.viral_score+case when public.viral_candidate_scores_v1.romania_evidence_class='VALIDATED' then coalesce(public.viral_candidate_scores_v1.romania_scarcity_score,0)*.15 else 0 end),
    lifecycle=case when excluded.lifecycle='UNVERIFIED' then 'UNVERIFIED'
      when excluded.viral_score+case when public.viral_candidate_scores_v1.romania_evidence_class='VALIDATED' then coalesce(public.viral_candidate_scores_v1.romania_scarcity_score,0)*.15 else 0 end>=80 then 'VIRAL'
      when excluded.viral_score+case when public.viral_candidate_scores_v1.romania_evidence_class='VALIDATED' then coalesce(public.viral_candidate_scores_v1.romania_scarcity_score,0)*.15 else 0 end>=60 then 'ACCELERATING'
      when excluded.viral_score>=35 then 'EARLY' else 'WATCH' end,
    score_inputs=excluded.score_inputs;
  get diagnostics v_count=row_count;
  return jsonb_build_object('schema','MPR_VIRAL_SCORE_REFRESH_RECEIPT_V1','scoresRefreshed',v_count,'providerDataSpendEur',0,'purchaseAuthorized',false,'claimsSales',false,'romaniaMissingAsScarcity',false);
end;
$$;

revoke all on function public.refresh_viral_candidate_scores_v1() from public,anon,authenticated;
grant execute on function public.refresh_viral_candidate_scores_v1() to service_role;

commit;
