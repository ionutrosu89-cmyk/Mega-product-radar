insert into public.launch_readiness_checks(check_code,status,evidence_note,verified_by,verified_at,updated_at)
values
('TECHNICAL_INTEGRITY','PASS','Main production integrity gate and CI matrix are passing after Amazon scheduled-history repair; source-control fix merged as #581. This is a technical gate only, not commercial readiness.',null,now(),now()),
('AMAZON_LONGITUDINAL_EVIDENCE','IN_REVIEW','Scheduled Amazon Need History run succeeded with 25/25 exact ASIN targets and 75 new observation rows at zero provider spend; longitudinal breadth is growing but not itself proof of verified sales.',null,now(),now()),
('ROMANIA_GAP_G2','BLOCKED','Romania G2 remains incomplete: Trendyol RO and independent RO retail-web hydration are not complete; market-wide competition ready remains unproven.',null,null,now()),
('ROMANIA_FALSE_POSITIVE_AUDIT','IN_REVIEW','Human audit currently contains 22 reviewed products: 20 LOW_GAP and 2 FALSE_POSITIVE. The intended 100-product benchmark is not complete.',null,null,now()),
('SUPPLIER_EVIDENCE','BLOCKED','No supplier_quotes are persisted yet. No supplier outreach or purchase may be implied.',null,null,now()),
('LANDED_ECONOMICS','BLOCKED','No landed_cost_runs_v3 are persisted yet. TEST_READY cannot be asserted without supplier and landed-cost evidence.',null,null,now()),
('BILLING_E2E','BLOCKED','Existing Stripe sandbox acceptance runs are still IN_PROGRESS and have not reached a completed acceptance verdict.',null,null,now()),
('BETA_PARTICIPANTS','BLOCKED','No beta participants are persisted yet.',null,null,now()),
('FINALIST_AUTHORIZATION','BLOCKED','No product currently has finalist_authorized=true under the evidence gates.',null,null,now()),
('PURCHASE_AUTHORIZATION','BLOCKED','Owner purchase authorization remains false by policy. No workflow may infer or auto-grant purchase approval.',null,null,now())
on conflict (check_code) do update
set status=excluded.status,
    evidence_note=excluded.evidence_note,
    verified_by=excluded.verified_by,
    verified_at=excluded.verified_at,
    updated_at=excluded.updated_at;
