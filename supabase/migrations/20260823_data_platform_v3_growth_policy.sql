-- Mega Product Radar · staged growth under owner-funded €100/month cap
create table if not exists public.data_growth_policy (
  stage smallint primary key check (stage between 0 and 3),
  candidate_target integer not null check (candidate_target > 0),
  max_monthly_spend_eur numeric(10,2) not null,
  min_enrichment_success_pct numeric(5,2) not null default 60,
  max_cost_per_useful_enrichment_eur numeric(10,4) not null default 0.25,
  requires_manual_promotion boolean not null default true,
  enabled boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.data_growth_policy(stage,candidate_target,max_monthly_spend_eur,min_enrichment_success_pct,max_cost_per_useful_enrichment_eur,requires_manual_promotion,enabled,notes)
values
(0,100,10,50,0.50,true,true,'Pilot: măsurăm costul și calitatea înainte de scalare.'),
(1,1000,25,60,0.35,true,false,'Se activează numai după pilot stabil și fără regresii de safety.'),
(2,5000,50,65,0.25,true,false,'Se activează după cost/enrichment predictibil și freshness stabil.'),
(3,10000,80,70,0.20,true,false,'Limita operațională înainte de reevaluarea arhitecturii și MRR.')
on conflict (stage) do update set
 candidate_target=excluded.candidate_target,
 max_monthly_spend_eur=excluded.max_monthly_spend_eur,
 min_enrichment_success_pct=excluded.min_enrichment_success_pct,
 max_cost_per_useful_enrichment_eur=excluded.max_cost_per_useful_enrichment_eur,
 requires_manual_promotion=excluded.requires_manual_promotion,
 enabled=excluded.enabled,
 notes=excluded.notes,
 updated_at=now();

alter table public.data_growth_policy enable row level security;
revoke all on public.data_growth_policy from anon, authenticated;