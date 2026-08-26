# Mega Product Radar — Final Product Master Plan V1

Status: CANONICAL EXECUTION PLAN
Owner objective: move MPR from feature-rich prototype to secure, coherent, data-backed SaaS for Product Opportunity Intelligence in Romania.

## North Star

Mega Product Radar answers: **What product is worth bringing to Romania, why, at what landed economics, and with what evidence/risk?**

Canonical sequence:

**GLOBAL DEMAND → TREND → ROMANIA GAP → IMPORTABILITY → SUPPLIER → ECONOMICS → EVIDENCE → DECISION**

Operating principle: **DATA → INTELLIGENCE → DECISION → EXECUTION**.

## Product positioning

MPR does not try to become a smaller Helium 10/Keepa. The proprietary advantage is the combined decision layer for Romania:

1. Romania Gap;
2. evidence-driven opportunity decision;
3. import-to-profit intelligence for Romania.

## Product development rule

Feature freeze applies to lateral features until P0/P1 are complete. Do not prioritize native mobile, generic AI chat, automatic purchasing, broad country expansion, cosmetic dashboards, or expensive untargeted data scale.

## Canonical funnel

`DISCOVERED → PROMISING → VALIDATE → FINALIST → TEST_READY → TEST_RUNNING → TEST_VALIDATED → BUY_READY`

- FINALIST is not purchase authority.
- TEST_READY is not purchase authority.
- BUY_READY requires measured real-world test evidence.
- Automated pipelines never authorize a purchase.

## P0 — Core Reset (7–14 days)

1. Billing authorization: owner-only subscription mutation; explicit workspace context.
2. Workspace context: every protected API receives/validates a workspace ID; no implicit `limit=1` workspace selection for money-sensitive operations.
3. Cloud sync: remove delete-all/insert-all; use record-level upsert, stable IDs, versions and optimistic concurrency.
4. Canonical identity: introduce `canonicalProductId`; product names become display labels, not foreign keys.
5. Database migrations: migrations are the source of truth; reproducible environment bootstrap.
6. Deployment: one production SaaS target; GitHub remains source/CI/data workflows.
7. Private commercial artifacts: supplier/RFQ/private evidence are never published as static public files.
8. Decision authority: First Finalist/evidence-driven domain becomes canonical; conflicting legacy score→BUY flows are retired or isolated.
9. Reproducible packages: lockfile + `npm ci`; dependency/security scanning.
10. Production security: CSP, security headers, rate limits, audit log, backup/restore checks, idempotent billing webhooks.

P0 exit rule: no unresolved critical billing authorization, tenant isolation, data-loss or conflicting-decision issue.

## P1 — Domain Architecture (2–3 weeks)

Canonical domain:

- CanonicalProduct
- ProductAlias
- MarketObservation
- TrendObservation
- RomaniaMarketObservation
- SupplierEvidence
- ImportabilityEvidence
- EconomicsRun
- OpportunityDecision

All domain records use `canonicalProductId`.

### Evidence contract

Every decision-relevant metric must support:

- value
- observedAt
- source
- sourceUrl/reference
- evidenceClass
- confidence
- freshness
- canonicalProductId

Evidence classes: `VERIFIED`, `DIRECT_OBSERVED`, `PROVIDER_VERIFIED`, `MANUALLY_VERIFIED`, `DERIVED`, `ESTIMATED`, `HEURISTIC`, `UNKNOWN`.

Missing remains unknown; it is never silently converted to zero.

## P2 — Product & Historical Data Foundation

Milestone sequence: 1K → 10K → 50K → 100K → 500K → 1M canonical products.

First serious milestone:

- 10,000 canonical products;
- >90% category identity;
- >70% direct-source coverage;
- >60% price/review observation coverage;
- <3% duplicate rate;
- 3,000+ products with ≥2 observations;
- 1,000+ with ≥3 observations.

Historical windows: 24h, 7d, 30d, 90d.

One generic Observation History Engine replaces round-specific one-off logic over time.

## P3 — Trend Intelligence V2

Trend is a composite of review growth, rank movement, search momentum, price stability, category momentum, seller/brand momentum, cross-market confirmation, persistence, freshness and evidence confidence.

A spike is not a confirmed trend. Persistence is mandatory for high-confidence acceleration.

## P4 — Romania Gap V2

Romania Gap becomes the primary proprietary product layer.

Pipeline:

`Canonical product → Romanian keyword family → intent → relevant listings → semantic comparability → variant dedup → seller dedup → competition map`

Core metrics:

- comparable listings
- unique sellers
- relevant brands
- median price
- review barrier
- price spread
- seller/brand concentration
- Romania demand
- gap score
- confidence

Coverage classes:

- `EXACT`: exhaustive market-wide evidence;
- `EXHAUSTIVE_QUERY`: all results from a defined comparable query surface classified/deduplicated;
- `ESTIMATED`: model/provider estimate.

Never relabel EXHAUSTIVE_QUERY or ESTIMATED as EXACT.

## P5 — Importability Engine

Hard blockers and confirmed-fact gates cover liquids, dangerous/restricted products, special authorizations, severe air-freight restrictions, extreme weight/volume and critical compliance barriers.

Soft-review signals cover batteries, fragility, electronics, textiles/sizing, food-contact, child products, seasonality and packaging burden.

Unknown critical facts fail closed.

## P6 — Supplier Intelligence V2

Supplier lifecycle:

`DISCOVERED → LISTING_OBSERVED → CONTACTED → QUOTE_RECEIVED → DOCUMENTED → MANUALLY_VERIFIED → AGENT_VERIFIED`

Supplier dossier includes identity, rating/history, MOQ, samples, price tiers, DDP/shipping, lead time, customization, packaging, certifications, quote timestamp and provenance.

First milestone: 20 products × 3 supplier dossiers. Next milestone: 100 products × 3 = 300 structured offers.

## P7 — Economics Engine V3

Base economics include supplier cost, freight, customs, brokerage, VAT treatment, domestic transport, packaging/labels, marketplace fees, fulfillment, returns, advertising, payment fees and warranty reserve.

Outputs:

- landed cost/unit
- contribution profit
- margin
- ROI
- break-even selling price
- maximum supplier/DDP price
- break-even ad rate
- break-even return rate
- Best/Base/Worst scenarios

Confirmed economics require complete evidence for required inputs.

## P8 — Opportunity Engine V5

Explainable score, separate from hard gates.

Suggested weight framework:

- Global Demand 20%
- Trend Acceleration 15%
- Romania Gap 25%
- Importability 10%
- Supplier Quality 10%
- Economics 15%
- Evidence Confidence 5%

Opportunity Score and Confidence Score are always separate. A high score with low confidence cannot become FINALIST.

## P9 — UX Reset

Primary customer navigation:

1. Today
2. Opportunities
3. Opportunity Detail

Secondary modules: Supplier, Economics, Watchlist, Account.

Opportunity Detail is the decision surface and shows Global Demand, Trend, Romania, Import, Supplier, Economics, Confidence, Evidence and next action in one place.

Primary actions: `IGNORE`, `WATCH`, `VALIDATE`.

## P10 — Closed Beta

Initial ICP: Romanian marketplace/import entrepreneur selling through eMAG/Trendyol/own site and actively sourcing new products.

Beta: 10–15 relevant users for 4–6 weeks.

Targets:

- activation >70%
- first useful opportunity <10 min
- WAU >50%
- useful opportunity rating >70%
- false-positive rate <20%
- Romania Gap useful >70%
- willingness to pay €29 >30%
- 4-week retention >40%

## P11 — Feedback & Calibration

Persist prediction vs actual outcomes: margin, sell-through, returns, ads, realized landed cost and opportunity outcomes. Use this to calibrate models and confidence.

## Platform architecture target

- GitHub: source, CI, data workflows
- Netlify: web app + protected API/functions
- Supabase: Auth, PostgreSQL, RLS, canonical application data
- Browser storage: cache/offline convenience only
- External providers: licensed/public/user-authorized enrichment with provenance and cost ledger

## Testing target

`Unit → Domain Integration → Supabase/RLS Integration → API → Playwright E2E → Production Smoke`

Mandatory journeys include auth/workspace, Discover/Radar entitlement, billing lifecycle, and `Product → Romania Gap → Supplier → Economics → FINALIST`.

## Cost discipline

Owner-funded external data remains capped under the existing budget policy. Paid enrichment is information-value-driven: cache first, batch first, cheap filters first, paid data only where it can materially change a decision.

## 30 / 60 / 90 day management milestones

### Day 30
- P0 complete
- canonical identity foundation
- single decision authority
- safe cloud sync architecture
- reproducible migrations/deployment
- 10K ingestion path ready

### Day 60
- 10K canonical products
- 3K longitudinal products
- 500+ Romania-enriched
- Romania Gap V2
- supplier database initial cohort
- Economics V3

### Day 90
- 1,000 Romania-enriched
- 100 deep validations
- 20 products with ≥3 supplier dossiers
- 10 confirmed landed economics
- 3+ legitimate FINALIST products
- closed beta with 10–15 relevant customers

## 6-month target framework

- 50K canonical products
- 15K historical products
- 5K Romania-enriched
- 1,000 structured supplier quotes
- 500 deep validations
- 30–50 legitimate finalists
- 20+ real test outcomes
- 50–100 paying users if willingness-to-pay and retention validate

These are management targets, not guarantees.

## Release rule

Every production capability requires: owner, specification, data contract, evidence policy, tests, telemetry, rollback and acceptance criteria.

Every intelligence engine must document two questions:

1. What can this engine legitimately claim?
2. What can it never claim from its current evidence?

## Final success criterion

MPR succeeds when a Romanian entrepreneur can open the product, see a small number of evidence-backed opportunities, understand why one is interesting, inspect Romanian competition, supplier/economics/import risk, and know the next rational action within minutes.
