# Mega Product Radar — Commercial Blueprint V2

## Product strategy

Mega Product Radar is one shared market-intelligence platform with four access levels. The plans are not separate products; they expose progressively deeper layers of the same data and intelligence system.

Core sequence:

**DATA → INTELLIGENCE → DECISION → EXECUTION**

The four customer questions are:

- **FREE — What documented products can I explore?**
- **DISCOVER — What is starting to move globally?**
- **RADAR — Which signals survive Romania Gap and importability gates?**
- **LAUNCH — Do sourcing and economics support execution?**

The platform must never present estimates as verified facts. Sensitive metrics must carry an evidence class such as `VERIFIED`, `ESTIMATED`, `DERIVED`, or `UNKNOWN`. Missing values remain unknown; they are never normalized to zero merely to complete a calculation.

## Plans

### Free — €0

Purpose: build habit and provide genuinely useful market intelligence before payment.

Free answers: **“What is selling in this category or niche?”**

Includes:
- Category Universe: department → category → niche;
- Top Products per category/niche, architected for Top 100;
- product price, rating, reviews and observed source rank where available;
- estimated units/revenue only when explicitly labeled as estimates;
- seller and brand intelligence;
- Top Sellers and Top Brands per category where evidence permits;
- market concentration metrics;
- basic market history and evidence confidence;
- direct public source references when available.

Free is designed for a large catalogue, not a showcase list. Architecture target: **100,000+ canonical products**, populated progressively.

Data milestones:
- 10,000 products — useful initial catalogue;
- 50,000 products — increasingly meaningful category rankings;
- 100,000 products — serious market-intelligence foundation.

Free does not include supplier economics, Romania opportunity detection, or execution services.

Primary CTA: **Track current global signals with Discover.**

### Discover — €17.90 / month

Purpose: add current global trend intelligence to the Free discovery layer.

Discover answers: **“What is starting to move globally, and is that movement persistent?”**

Includes everything in Free plus:
- Rising and New Products;
- Trend Intelligence and persistence windows;
- multi-market confirmation;
- keyword/search momentum where the source permits it;
- filters, alerts and extended history.

Primary CTA: **Find emerging Romania opportunities with Radar.**

### Radar — €29 / month

Purpose: identify opportunities before they become obvious.

Radar answers: **“What is starting to grow, and where is the Romanian market still under-supplied?”**

Includes everything in Discover plus:
- brand and importability hard gates;
- alerts and watchlists;
- Romania demand intelligence;
- local listing/seller/price context;
- Romania Gap;
- Opportunity Engine combining global demand, growth, Romanian demand, local competition, importability and data confidence;
- evidence-backed commercial decision support.

Initial Romania intelligence milestone: **1,000 products** with useful Romanian keyword/demand, competition, seller-density and price context.

Radar is the main opportunity-detection layer and the primary proprietary differentiation of MPR.

Primary CTA: **Turn the opportunity into an execution plan with Launch.**

### Launch — €89 / month

Purpose: convert intelligence into a structured route from idea to operating business.

Launch answers: **“How do I actually execute?”**

Includes everything in Radar plus:
- Supplier Intelligence and a minimum three-option benchmark for deep candidates;
- quote evidence ledger;
- Landed Cost scenarios;
- profit, margin, ROI and break-even analysis;
- personalized shortlist;
- capital and budget planning;
- Launch roadmap;
- Launch Academy România;
- company setup guidance;
- accounting and operational setup guidance;
- sourcing and negotiation education;
- import and compliance education;
- marketplace setup and listing guidance;
- marketing and launch guidance;
- portfolio / actual-results feedback loop;
- Partner Network as it becomes available;
- access/introduction to a tested/verified China sourcing contact when available.

Launch Academy should evolve from a static article library into an interactive checklist and execution roadmap.

Supplier database milestone: **100 products × minimum 3 supplier observations = 300 structured supplier offers**.

Suggested curriculum:
1. Company / legal setup;
2. Accounting, banking and cash flow;
3. Marketplaces and channels;
4. Product sourcing;
5. Import and freight;
6. Compliance and labeling;
7. Operations, couriers and fulfillment;
8. Listings and content;
9. Marketing and PPC;
10. First launch and scaling.

## Partner Network

Launch may surface external service providers such as:
- accountants;
- company-formation services;
- couriers;
- fulfillment providers;
- marketplace integrators;
- product photography/content services;
- sourcing agents;
- freight forwarders;
- compliance specialists.

Partner status must be explicit, for example `PARTNER`, `VERIFIED`, or `USER_REVIEWED`. MPR must not imply that an external provider is independently verified without recorded evidence.

## Human sourcing

Human China sourcing is **not unlimited and is not included as a generic SaaS entitlement**.

Where offered, sourcing/negotiation/inspection/consolidation/freight coordination is a separate paid service or an external partner service. The Launch subscription may include access, workflow support, educational material, or an introduction, but not unlimited manual sourcing labor.

## Product architecture

### Shared data foundation

All plans rely on the same underlying graph:

**Category ↔ Product ↔ Seller ↔ Brand ↔ Supplier ↔ Market observations ↔ Romania observations**

Key foundations:
- canonical product identity;
- append-only historical observations;
- category hierarchy;
- seller/brand relationships;
- supplier evidence;
- explicit provenance and evidence class;
- confidence and freshness metadata.

### Free workspace

Core screens:
- Categories;
- Top Products;
- Product Market Detail;
- Top Sellers;
- Top Brands;
- Market History.

### Discover workspace

Core screens:
- Supplier Intelligence;
- Supplier Benchmark;
- Quote Evidence;
- Landed Cost;
- Profit & ROI;
- Import Risk / Economics.

### Radar workspace

Core screens:
- Trending / Rising / New;
- Romania Gap;
- Opportunities;
- Opportunity Detail;
- Alerts;
- Watchlist.

### Launch workspace

Core screens:
- My Business;
- Personalized Shortlist;
- Capital Plan;
- Launch Roadmap;
- Academy;
- Partner Network;
- Portfolio / Actual Results.

## Ranking and evidence policy

MPR ranking is an internal intelligence ranking. It is never equivalent to a marketplace's official bestseller ranking unless the source rank itself was explicitly observed.

Examples:
- `MPR Rank` = internal derived rank;
- `Source Rank` = only when explicitly observed from the source;
- `Estimated Sales` = model/provider estimate;
- `Verified Sales` = only actual evidence satisfying the relevant verification standard.

Sparse records must be penalized for missing information rather than rewarded by silently converting blanks to zeros.

## Data strategy

Do not recreate every competitor's raw data infrastructure from scratch.

Preferred model:
1. ingest legally and technically available public/licensed/API data;
2. retain source identity and provenance;
3. normalize into canonical products/categories/sellers/brands;
4. preserve history instead of overwriting observations;
5. enrich only where information value justifies cost;
6. combine global market data with Romanian intelligence;
7. add proprietary supplier, economics and opportunity layers.

The moat is the combined graph and decision layer, not a single raw-data provider.

## Cost discipline

Large catalogue architecture does not imply expensive enrichment for every product every day.

Use staged freshness tiers and information-value budgeting:
- broad inexpensive catalogue coverage;
- deeper enrichment for active/high-information products;
- paid data only where it materially improves decisions;
- no automatic Stage 1 scale merely to increase vanity metrics.

## Commercial funnel

Free documented exploration → Discover global trend intelligence → Radar Romania opportunity validation → Launch sourcing/economics and execution → optional paid partner/human services.

Upgrade triggers:
- Free: user wants current trend context;
- Discover: user wants Romania opportunity validation;
- Radar: user wants a personalized execution roadmap;
- Launch: optional external/human services when needed.

## Validation milestones

1. Category Universe foundation.
2. Product Universe and historical observations.
3. Top Products FREE engine.
4. Seller & Brand Intelligence.
5. Trend Intelligence.
6. Discover global trend experience.
7. Romania Gap V1.
8. Opportunity Engine and hard gates.
9. Alerts / Radar feed.
10. Supplier Evidence Database and Benchmark Engine.
11. Launch economics, Academy and roadmap.
12. Partner Network.
13. 5–10 closed beta users.
14. First paid customer.
15. 20 paid customers and retention review.

## Core KPIs

Data foundation:
- canonical product count;
- category/niche coverage;
- direct-source coverage;
- historical snapshot coverage;
- seller/brand coverage;
- data confidence and freshness.

Commercial:
- Free → Discover conversion;
- Discover → Radar conversion;
- Radar → Launch conversion;
- weekly active users;
- products/categories opened and saved;
- supplier dossiers opened;
- opportunity alerts opened;
- retention;
- MRR and churn.

Model quality:
- ranking stability;
- estimate calibration;
- Romania Gap precision after real outcomes;
- supplier benchmark sample depth;
- predicted vs actual economics when users voluntarily provide real outcomes.

## Non-goals for the current stage

Do not prioritize yet:
- native mobile application;
- complex general-purpose AI chatbot;
- automatic purchasing;
- automatic China orders;
- aggressive paid-data scale;
- many marketplaces at once;
- visual polish ahead of data quality.

Current priority remains:

**Category Universe → Product Universe → Top Products → Seller & Brand → Discover Trend → Romania Gap → Opportunity Engine → Launch Supplier/Economics and execution.**
