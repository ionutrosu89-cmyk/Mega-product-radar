# Mega Data Platform V3 · Five-sprint runbook

## Non-negotiables
- Owner-funded external spend: maximum €100/calendar month.
- Soft stop: €80. €20 remains reserve.
- Missing evidence stays missing; no synthetic commercial facts.
- Paid data is purchased only when it can materially change a decision.
- Prefer official APIs, licensed providers and user-authorized integrations.
- Keep source provenance and usage/retention rights for every source.

## Sprint 1 · Data Platform V3 Foundation
Delivered foundation:
- canonical_products
- product_aliases / identity graph
- append-only product_observations
- data_sources provenance registry
- data_cost_ledger
- commercial_outcomes feedback loop

Acceptance:
- one canonical product may have many marketplace aliases
- old observations are never overwritten
- every observation has a source
- every paid call can be assigned a EUR cost

## Sprint 2 · Budget Brain & Freshness Engine
Delivered foundation:
- data_budget_policy: hard cap €100, soft stop €80
- refresh_queue with HOT/ACTIVE/DISCOVERY/LONG_TAIL tiers
- information_value and estimated_cost_eur fields
- monthly budget view

Execution rules:
1. cache first
2. batch first
3. free/cheap filters first
4. paid enrichment only after thresholds
5. skip with SKIPPED_BUDGET instead of silently overspending

Refresh targets:
- HOT <= 1h
- ACTIVE <= 12h
- DISCOVERY <= 72h
- LONG_TAIL <= 30d
These are targets, not promises; provider limits and budget always win.

## Sprint 3 · Romania Intelligence V3
Delivered schema:
- romania_market_snapshots
- search volume / trends
- median RO price
- listing/seller density
- review barrier
- demand / competition / Romania Gap / confidence

Provider order:
1. DataForSEO batch endpoints where contractually permitted
2. official/user-authorized marketplace APIs
3. terms-permitted public evidence

Do not claim real-time eMAG/Trendyol coverage until a lawful reliable provider/integration exists.

## Sprint 4 · Supplier Intelligence V3
Delivered schema:
- suppliers
- supplier_quotes
- landed_cost_runs_v3
- verification level including AGENT_TESTED

Rules:
- supplier facts require evidence
- quote timestamps are mandatory
- Launch includes access/introduction to tested China agent; agent services are separately contracted
- landed cost remains unconfirmed until required components are evidenced

## Sprint 5 · Launch Academy V1
Curriculum lives in LAUNCH_ACADEMY_V1.md.
Next productization step is a gated Launch UI with progress tracking, toolkit downloads/templates and later monthly Q&A.

## 90-day operating targets (targets, not guarantees)
- 20k–50k raw candidates
- >=5k canonical products
- >=1k Romania-enriched products
- 100–300 deep validations
- first legitimate FINALIST / TEST_READY products
- external data spend <= €100/month

## Scale trigger
Do not increase owner-funded data budget. Reinvest product MRR under an explicit policy after willingness-to-pay is proven.

Suggested reinvestment checkpoints:
- €1k MRR: up to €200–300 data/infrastructure budget if unit economics support it
- €3k MRR: up to €500–700
- €10k MRR: up to €1.5k–2k

## KPIs
- cost / discovered candidate
- cost / PROMISING
- cost / VALIDATE
- cost / FINALIST
- cost / TEST_READY
- source coverage / product
- freshness SLA attainment
- duplicate rate
- Romania enrichment coverage
- prediction vs actual outcome calibration
