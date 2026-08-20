# Mega Product Radar — Commercial Blueprint V1

## Positioning

Mega Product Radar turns global product signals into Romania-focused commercial decisions.

Core promise:

- **DISCOVER — What is selling?**
- **RADAR — What should I sell?**
- **LAUNCH — How do I start selling it?**

The platform must never present estimates as verified facts. Every sensitive metric must carry an evidence class: `VERIFIED`, `ESTIMATED`, or `DERIVED`.

## Plans

### Free — €0
Purpose: acquisition and habit creation.

Includes:
- 3 trending product views / scan credits
- limited Top Products
- basic platform, price, trend and rating signals
- locked Romania opportunity, sourcing and economics

Primary CTA: Upgrade to Discover.

### Discover — €17.90 / month
Purpose: answer “what is selling?”.

Includes:
- Top Products by source/category
- Amazon / TikTok-oriented trend feeds as connectors become available
- Rising / New / Growth views
- history and trend direction
- filters and alerts
- data confidence labels

Does not include:
- Romania Gap
- supplier shortlist
- landed cost
- profit / ROI
- TEST / HOLD decision

Primary CTA: Analyze with Radar.

### Radar — €29 / month
Purpose: answer “what should I sell in Romania?”.

Includes everything in Discover plus:
- Romania Gap
- local competition and price context
- supplier intelligence
- landed cost
- profit, margin and ROI
- import risk
- 9-gate commercial decision engine
- TEST / HOLD / TEST_READY workflow
- watchlist

Primary CTA: Build a launch plan.

### Launch — €89 / month
Purpose: answer “how do I launch this product?”.

Includes everything in Radar plus:
- personalized shortlist
- capital / budget plan
- launch plan
- supplier shortlist
- purchase workflow
- portfolio feedback loop
- exportable business case

Human China sourcing is **not unlimited and is not included as a generic SaaS entitlement**.

## Human sourcing add-on

Human sourcing is billed separately per project/request. Scope can include:
- supplier outreach
- quote comparison
- DDP / freight clarification
- sample coordination
- negotiation support
- China agent handoff

This keeps SaaS gross margin protected and prevents the €89 tier from becoming an unlimited consulting service.

## Product architecture

### Discover workspace
Screens:
- Top Products
- Rising
- New
- Categories
- Source view
- Product signal detail

Required fields where available:
- product
- source/platform
- market/country
- current price
- estimated/verified units
- estimated/verified GMV/revenue
- rating
- review count
- growth 7d / 30d
- rank history
- evidence class
- last updated

### Radar workspace
Screens:
- Opportunities
- Romania Gap
- Product Decision
- Supplier Intelligence
- Landed Cost
- Profit & ROI
- Import Risk
- Watchlist
- TEST_READY queue

### Launch workspace
Screens:
- My Business
- Product Shortlist
- Capital Plan
- Supplier Plan
- Purchase Plan
- Launch Checklist
- Portfolio / Actual Results

## Data strategy

Do not attempt to recreate Helium 10 or Kalodata infrastructure from scratch.

Preferred model:
1. ingest legally/technically available source data and licensed/API data;
2. normalize source metrics;
3. label confidence honestly;
4. combine global signals with Romania intelligence;
5. run proprietary sourcing/economics/decision layers.

The moat is the decision layer, not raw data volume.

## Commercial funnel

Free traffic → Discover (€17.90) → Radar (€29) → Launch (€89) → Human sourcing add-on.

Upgrade triggers:
- Free: lock history / full top lists.
- Discover: lock Romania Gap, supplier and economics.
- Radar: lock personalized launch plan and capital plan.
- Launch: offer human sourcing as paid add-on.

## Validation milestones

M1. Commercial tiers and entitlements implemented.
M2. Pricing page and paywall states implemented.
M3. Discover dashboard with real source/confidence labels.
M4. Radar entitlements connected to current decision engine.
M5. Launch workspace implemented.
M6. Billing provider integration.
M7. 5–10 closed beta users.
M8. First paid customer.
M9. 20 paid customers and retention review.

## Core KPIs

Do not optimize for number of scanned products alone.

Track:
- Free → Discover conversion
- Discover → Radar conversion
- Radar → Launch conversion
- weekly active users
- opportunities opened / saved
- TEST_READY rate
- real tests launched
- recommendation precision after real-world feedback
- avoided bad purchases
- MRR
- churn
- gross margin, especially on human sourcing

## Launch rule

Do not market “guaranteed winning products”. Use evidence-backed language:
- Opportunity Score
- confidence level
- TEST / HOLD
- recommended test quantity
- maximum acceptable landed cost

The platform recommends controlled tests; it does not guarantee profit.
