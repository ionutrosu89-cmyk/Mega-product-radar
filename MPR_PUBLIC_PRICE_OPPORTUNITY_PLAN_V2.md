# Mega Product Radar — Public Price Opportunity Engine V2

Status: CANONICAL EXECUTION PLAN — proposed
Date: 2026-08-29

## 1. Strategic decision

Mega Product Radar will prioritize scalable product opportunity discovery using publicly observable prices and conservative estimated economics.

Canonical sequence:

**MARKETPLACE PRODUCT → MARKETPLACE PRICE → PUBLIC 1688/ALIBABA PRICE → PRODUCT MATCH → ESTIMATED LANDED COST → PROFIT/ROI → DEMAND SIGNALS → COMPETITION → OPPORTUNITY RANKING → HUMAN REVIEW**

Supplier negotiation is explicitly outside the base case. Negotiation may later create additional upside but must never be required for a product to look attractive in the initial screen.

This plan supplements the existing Final Product Master Plan V1 and changes the practical execution priority from quote-first validation to public-price-first large-scale screening.

## 2. North Star

For every product, MPR should answer:

1. What is the observable selling price across major marketplaces?
2. What is the observable public sourcing price on 1688/Alibaba?
3. Are the marketplace and supplier products genuinely comparable?
4. What is a conservative estimated landed cost in Romania?
5. What estimated profit, net margin and ROI remain after all relevant costs?
6. Is there evidence of demand?
7. How crowded is the market?
8. Is this product worth human review?

The system must be capable of answering these questions for tens or hundreds of thousands of products without supplier outreach.

## 3. Truth contract

These rules are non-negotiable:

- unknown != zero;
- marketplace list price != realized selling price;
- supplier public listing price != verified quote;
- supplier listing price != landed cost;
- minimum advertised range price != usable unit cost by default;
- review count/rank/visibility != verified sales;
- similar-looking products != same product;
- negotiation discount != base economics;
- estimated freight != confirmed freight;
- estimated duty != confirmed customs classification;
- sampled marketplace search != exact market-wide competition;
- one high marketplace price != representative sell price.

Every numeric field used for scoring must carry evidence class, source, timestamp and confidence.

## 4. Economic philosophy

The product must work using public prices.

Base economics should use:

- conservative marketplace sell price;
- conservative public supplier price;
- conservative freight estimate;
- explicit tax/duty assumptions;
- marketplace commission;
- fulfillment;
- advertising reserve;
- return reserve;
- packaging/compliance reserve;
- other configurable reserves.

Negotiation is shown later as `negotiationUpside`, never included in base ROI.

A product that only becomes attractive after assumed negotiation is not a strong discovery candidate.

## 5. Target scale

### Universe targets

- Stage A: 10,000 commercially useful products with economics pipeline coverage.
- Stage B: 50,000.
- Stage C: 100,000+.
- Stage D: 500,000+ as source coverage and infrastructure mature.

Raw catalog size is not sufficient. A product becomes commercially useful only when it has adequate identity, marketplace observations and at least one sourcing candidate or an explicit supplier-match gap.

### Initial business-use success target

At least:

- 100,000 marketplace product identities;
- 30,000 with sufficient normalized attributes for supplier matching;
- 20,000 with one or more supplier candidates;
- 10,000 with match confidence >= 80;
- 5,000 with conservative economics calculable;
- 1,000 with meaningful demand signals;
- 100 high-quality human-review candidates;
- 20 deep-review candidates;
- 5-10 commercial shortlist candidates.

Targets are management targets, not guarantees.

## 6. Source strategy

### Marketplace sell-side sources

Priority order:

1. Amazon
2. eBay
3. eMAG
4. Trendyol
5. Allegro / Kaufland / Walmart / other accessible marketplaces later

For every sell-side observation store:

- platform;
- canonicalProductId;
- marketplaceListingId;
- sourceUrl;
- titleRaw;
- titleNormalized;
- seller;
- brand;
- currency;
- priceGross;
- shippingPrice if observable;
- packCount;
- variant;
- material;
- dimensions;
- weight;
- rating;
- reviewCount;
- rank/BSR where available;
- availability;
- observedAt;
- evidenceClass;
- confidence.

### Supplier sources

Priority order:

1. 1688
2. Alibaba
3. Made-in-China / GlobalSources only as optional supplement

Store:

- platform;
- supplierListingId;
- supplierName if observable;
- sourceUrl;
- titleRaw;
- titleNormalized;
- currency;
- publicPriceMin;
- publicPriceMax;
- priceTiers;
- MOQ;
- priceUnit;
- material;
- dimensions;
- weight;
- pack configuration;
- variant;
- packaging data;
- public freight data if present;
- observedAt;
- evidenceClass=`PUBLIC_SUPPLIER_LISTING`;
- confidence.

Never set `verifiedQuote=true` from a public listing.

## 7. Canonical product model

Every product is represented through a stable `canonicalProductId`.

### ProductFingerprint V1

Core comparable attributes:

- category;
- productType;
- primaryFunction;
- packCount;
- material;
- dimensions;
- weight or density class;
- capacity where relevant;
- power/specification where relevant;
- target user;
- form factor;
- important variant attributes;
- regulatory class;
- brand dependence.

Fingerprints must distinguish identity-critical fields from descriptive fields.

Examples:

A 4-pack 100x180 cm cotton beach towel is not automatically equivalent to:

- one 100x180 towel;
- a 2-pack;
- microfiber towels;
- bath towels without beach positioning;
- cotton-blend towels if material is commercially important.

## 8. Product matching engine

### Match score

Recommended initial weights:

- category/product type: 15%
- pack count: 20%
- material: 15%
- dimensions/capacity: 15%
- technical specifications/function: 15%
- weight/form factor: 10%
- variant/design relevance: 5%
- title semantic similarity: 5%

Weights become category-specific later.

### Match classes

- 95-100: `NEAR_EXACT_MATCH`
- 85-94: `HIGH_CONFIDENCE_MATCH`
- 80-84: `ACCEPTABLE_SCREENING_MATCH`
- 65-79: `POSSIBLE_MATCH_REVIEW_REQUIRED`
- <65: `REJECTED_MATCH`

Base economics ranking requires match confidence >= 80 unless an explicit category rule says otherwise.

Hard mismatch fields can veto score regardless of semantic similarity, e.g. wrong pack count, materially different dimensions, battery vs non-battery, child-certified vs generic, etc.

## 9. Public supplier price normalization

The system must not cherry-pick the lowest visible price.

### Price selection hierarchy

1. Exact tier matching target MOQ/order size.
2. Closest higher-cost tier when exact target tier is unavailable.
3. `publicPriceMax` for ambiguous ranges.
4. Conservative range midpoint only if a documented rule explicitly allows it.
5. Unknown if price unit or variant cannot be resolved.

Store both raw and normalized values.

Fields:

- supplierPriceRaw;
- supplierPriceNormalized;
- supplierPriceCurrency;
- supplierPriceRuleUsed;
- supplierPriceConfidence;
- targetOrderQuantity;
- MOQCompatible;
- priceTierResolved.

## 10. Sell-price normalization

Do not build economics on the highest observed listing.

For a comparable listing cohort calculate:

- min;
- p25;
- median;
- p75;
- max;
- listing count;
- seller count;
- freshness.

Primary base-case sell price should initially use the lower of:

- median comparable price;
- a configured conservative percentile such as p40;
- a category-specific competitive-price rule.

Worst-case can use p25; best-case can use median/p60 only when supported.

Every economics run records the exact sell-price rule used.

## 11. Estimated Landed Cost V1

Public supplier price is the starting input, not the landed cost.

### Required cost model

`estimatedLandedCost = supplierProductCost + internationalFreight + insurance + customsDuty + brokerage + importHandling + domesticTransport + packagingLabeling + complianceReserve + nonRecoverableTax + otherImportReserve`

### Freight estimator

Inputs where available:

- actual unit weight;
- carton weight;
- unit/carton dimensions;
- volumetric weight;
- units/carton;
- route;
- transport mode.

When dimensions are unknown, use category-specific conservative freight profiles and label confidence `LOW`.

Scenarios:

- Best
- Base
- Conservative

Main ranking uses Conservative.

### Customs/tax

Duty and tax assumptions must carry source and confidence. Unknown tariff classification cannot silently become 0% duty.

Estimated classes are allowed for screening but must be labeled `ESTIMATED`.

## 12. Marketplace Economics Engine

For each marketplace/product scenario calculate:

`netRevenue = grossSellPrice / (1 + sellVATRate)`

Then subtract:

- estimated landed cost;
- marketplace commission;
- fulfillment;
- payment fees if applicable;
- advertising reserve;
- returns reserve;
- warranty reserve;
- packaging/label costs not already included;
- other configurable operating reserves.

Outputs:

- estimatedProfitPerUnit;
- estimatedNetMargin;
- estimatedROIOnLandedCost;
- breakEvenGrossSellPrice;
- maximumViableSupplierPrice;
- maximumViableFreight;
- breakEvenAdRate;
- breakEvenReturnRate;
- Best/Base/Conservative scenarios.

### Required economic labels

- `SCREENING_ESTIMATE`
- `HIGH_CONFIDENCE_ESTIMATE`
- `CONFIRMED` only when contractually complete evidence exists.

The large-scale engine primarily produces `SCREENING_ESTIMATE`.

## 13. Economic gates

Initial shortlist gates for Conservative scenario:

- matchConfidence >= 80;
- supplier price confidence >= minimum category threshold;
- sell price based on >=1 valid direct observation and preferably cohort data;
- estimated ROI >= 80%;
- estimated net margin >= 25%;
- profit/unit above configurable absolute threshold;
- no critical importability blocker;
- no unknown cost silently coerced to zero.

High-priority band:

- ROI >= 150%;
- net margin >= 35%;
- positive demand signal;
- matchConfidence >= 90.

These thresholds are tunable after backtesting.

## 14. Demand engine

Demand remains separate from economics.

Possible signals:

- Amazon BSR/rank and direction;
- review count;
- review velocity;
- rating stability;
- search visibility;
- cross-market listing presence;
- cross-market price persistence;
- marketplace popularity labels where observable;
- seller count movement;
- trend persistence.

Output classes:

- `STRONG_DEMAND_SIGNAL`
- `MODERATE_DEMAND_SIGNAL`
- `WEAK_DEMAND_SIGNAL`
- `INSUFFICIENT_DEMAND_EVIDENCE`

Never call these verified sales unless the source genuinely provides verified sales data.

## 15. Competition engine

For scalable screening, competition does not require exact MARKET_WIDE proof.

We use distinct classes:

- `EXACT_MARKET_WIDE`
- `EXHAUSTIVE_QUERY_SURFACE`
- `SAMPLED_COMPETITION_ESTIMATE`
- `UNKNOWN`

Screening ranking can use `SAMPLED_COMPETITION_ESTIMATE`; final confirmed claims cannot relabel it exact.

Useful metrics:

- comparable listing count estimate;
- unique sellers;
- brands;
- price compression;
- median review barrier;
- concentration;
- local Romania presence;
- cross-market saturation.

## 16. Opportunity Score V2

Score and confidence are separate.

Suggested score weights:

- Economics: 40%
- Demand: 25%
- Competition/Gaps: 15%
- Product Match Quality: 10%
- Logistics/Importability: 5%
- Supplier Listing Quality: 5%

### Confidence Score

Based on:

- observation freshness;
- number of independent sources;
- product match confidence;
- cost-model completeness;
- supplier price clarity;
- marketplace price cohort size;
- demand evidence persistence.

A product may have score 90/100 with confidence 45/100; it must not be treated the same as score 84 with confidence 90.

## 17. Funnel

Canonical screening funnel:

`CATALOGUED → PRICE_OBSERVED → SUPPLIER_CANDIDATE_FOUND → MATCHED → ECONOMICS_SCREENED → DEMAND_SCREENED → OPPORTUNITY_RANKED → HUMAN_REVIEW → COMMERCIAL_SHORTLIST`

This is separate from legacy evidence funnel:

`PROMISING → VALIDATE → FINALIST → ...`

The screening funnel can feed the legacy deep-validation funnel when desired, but does not require supplier outreach or exact Romania Gap to produce useful ranked opportunities.

## 18. Ranking cohorts

### Cohort A — broad universe

100K+ products, identity and marketplace price observations.

### Cohort B — sourcing matched

20K+ with supplier candidates.

### Cohort C — economics-ready

5K+ with match >=80 and enough inputs for Conservative screening economics.

### Cohort D — ranked opportunity

1K+ passing economics + demand/competition minimums.

### Cohort E — human review

Top 100.

### Cohort F — commercial shortlist

Top 20 then top 5-10.

## 19. Data architecture

Recommended entities:

- CanonicalProduct
- ProductFingerprint
- MarketplaceListing
- MarketplacePriceObservation
- DemandObservation
- SupplierListing
- SupplierPriceObservation
- ProductSupplierMatch
- FreightEstimate
- DutyTaxEstimate
- EconomicsScreeningRun
- CompetitionObservation
- OpportunityScoreRun
- HumanReviewDecision

Every record uses canonicalProductId where applicable.

### Required provenance fields

- sourcePlatform;
- sourceUrl/reference;
- observedAt;
- evidenceClass;
- confidence;
- extractionMethod;
- rawValue;
- normalizedValue;
- transformationRuleVersion.

## 20. Freshness rules

Initial defaults:

- marketplace price: <=7 days for high confidence;
- supplier public price: <=14 days for high confidence;
- demand signals: <=7 days for fast-moving categories;
- freight model: monthly refresh or when route cost changes materially;
- FX: current source when economics is calculated;
- marketplace commission tables: versioned and refreshed when fee schedules change.

Stale evidence decreases Confidence Score instead of disappearing silently.

## 21. Deduplication

Dedup levels:

1. exact listing ID;
2. platform identity such as ASIN/item ID;
3. normalized canonical product fingerprint;
4. variant-level identity;
5. cross-market canonical product.

Do not merge materially different pack sizes or variants into one economics unit.

## 22. Category exclusions / risk gates

Initial automated exclusion or heavy penalty for categories with disproportionate compliance or logistics risk unless explicit evidence exists:

- regulated medical products;
- dangerous goods;
- liquids with difficult air-freight profile;
- high-risk batteries;
- food/supplements;
- cosmetics requiring compliance dossier;
- very bulky low-value products;
- products with unclear intellectual-property risk.

A category can later receive its own importability profile.

## 23. Phase plan

### Phase 0 — Pivot contract and architecture

Deliverables:

- this canonical plan;
- new screening funnel;
- truth labels;
- KPI definitions;
- backlog epics.

Exit:

- no ambiguity that negotiation/quotes are excluded from base screening economics.

### Phase 1 — Unified product schema + fingerprint

Deliverables:

- ProductFingerprint V1;
- normalized marketplace/supplier schemas;
- variant and pack-count rules;
- deterministic identity tests.

Exit:

- 95%+ fixture correctness on curated identity/mismatch set;
- no known pack-count merge bug.

### Phase 2 — Marketplace database

Deliverables:

- ingestion adapters for Amazon/eBay/eMAG/Trendyol according to available lawful/access-compatible sources;
- normalized marketplace price ledger;
- dedup;
- freshness and provenance.

Exit target:

- 10K useful marketplace products first;
- then 50K;
- then 100K+.

### Phase 3 — 1688/Alibaba sourcing database

Deliverables:

- supplier listing schema;
- public price ranges/tiers/MOQ parser;
- supplier-product candidate retrieval;
- price normalization rules.

Exit target:

- supplier candidates for >=20% of commercially useful marketplace universe in first scalable release;
- expand toward >=30%.

### Phase 4 — Product matching

Deliverables:

- deterministic feature comparator;
- semantic similarity layer;
- hard mismatch gates;
- match-confidence calibration dataset.

Exit:

- precision prioritized over recall;
- >=90% precision on HIGH_CONFIDENCE_MATCH validation sample.

### Phase 5 — Estimated landed economics

Deliverables:

- conservative freight estimator;
- tax/duty estimate contract;
- marketplace fee tables;
- Best/Base/Conservative economics;
- unknown-value fencing.

Exit:

- 5K products calculable without fabricated zeroes;
- deterministic tests for all formulas.

### Phase 6 — Demand + competition

Deliverables:

- demand signal normalization;
- longitudinal observation support;
- scalable sampled competition metrics;
- evidence classes kept separate from exact claims.

Exit:

- >=1K economics-ready products with usable demand evidence.

### Phase 7 — Opportunity ranking

Deliverables:

- Opportunity Score V2;
- Confidence Score;
- hard gates;
- explainable score components;
- top 100 human-review queue.

Exit:

- every shortlisted product shows exactly why it ranked and what evidence is weak.

### Phase 8 — Dashboard + review workflow

Deliverables:

- opportunity table;
- filters by ROI, margin, profit, category, marketplace, supplier source, confidence;
- product detail with marketplace price vs supplier price vs estimated landed cost;
- scenario analysis;
- human `IGNORE/WATCH/SHORTLIST` decision.

Exit:

- owner can identify top opportunities in minutes without reading raw JSON.

## 24. First implementation sprint

Order:

1. Freeze V2 contracts.
2. Build ProductFingerprint V1.
3. Build MarketplacePriceObservation schema.
4. Build SupplierPriceObservation schema.
5. Build public-price normalization.
6. Build matching V1.
7. Extend landed economics calculator with SCREENING_ESTIMATE mode.
8. Build sell-price cohort normalizer.
9. Build opportunity screening engine.
10. Run first 10K product cohort end-to-end.

Do not attempt to perfect all marketplaces before the first end-to-end cohort works.

## 25. 7 / 30 / 60 / 90-day targets

### First 7 days

- V2 plan merged;
- epics created;
- ProductFingerprint V1 implemented;
- public marketplace/supplier price schemas implemented;
- initial matching test set;
- screening economics contract implemented.

### Day 30

- 10K commercially useful marketplace products;
- >=3K supplier candidates;
- >=1K high-confidence matches;
- >=500 conservative economics runs;
- first ranked top 100.

### Day 60

- 50K marketplace products;
- >=12K supplier candidates;
- >=5K high-confidence matches;
- >=2K economics-ready products;
- demand/competition scoring live;
- top 100 refreshed automatically.

### Day 90

- 100K+ marketplace identities;
- >=20K supplier candidates;
- >=10K high-confidence matches;
- >=5K economics-ready;
- >=1K demand-screened;
- 100 human-review opportunities;
- 20 commercial shortlist products;
- 5-10 top opportunities with strong conservative economics.

## 26. KPI dashboard

Core KPIs:

1. marketplaceProductsTotal
2. marketplaceProductsFresh7d
3. supplierListingsTotal
4. productsWithSupplierCandidate
5. productsWithMatch80Plus
6. productsWithMatch90Plus
7. productsWithScreeningEconomics
8. productsPassingROI80
9. productsPassingMargin25
10. productsWithDemandSignal
11. rankedOpportunityCount
12. humanReviewQueueCount
13. commercialShortlistCount
14. medianMatchConfidence
15. medianEconomicsConfidence
16. duplicateRate
17. staleObservationRate
18. estimatedCostUnknownRate

Do not optimize only for catalog size.

## 27. Backtesting and calibration

Before trusting ranking, manually review stratified samples:

- 50 top-score products;
- 50 middle-score products;
- 50 rejected products;
- 50 supplier matches around score threshold.

Measure:

- supplier match precision;
- false-positive economics rate;
- missing-cost rate;
- unrealistic sell-price rate;
- ranking usefulness.

Tune thresholds from evidence, not intuition.

## 28. Negotiation upside module — later

Negotiation is not part of initial screening.

For shortlisted products only, an optional future module can show:

- base public supplier price;
- hypothetical 5%/10%/15% discount scenarios;
- additional profit;
- additional ROI.

These are scenario values, not evidence, until a real negotiated price exists.

## 29. Cost discipline

Use free/public data first where reliable.

Paid data is used when it materially improves one of:

- product identity;
- price coverage;
- demand confidence;
- supplier matching;
- ranking quality.

Existing paid-data hard caps remain fail-closed. No new spend is authorized by this document.

## 30. Definition of Done for V2 core

The V2 core is complete when MPR can take a large marketplace product universe and automatically produce a ranked table where each row contains:

- canonical product;
- marketplace sell-price cohort;
- 1688/Alibaba public supplier price;
- product-match confidence;
- conservative estimated landed cost;
- estimated profit/unit;
- estimated net margin;
- estimated ROI;
- demand score/class;
- competition score/class;
- opportunity score;
- confidence score;
- evidence freshness;
- blockers/unknowns;
- source links.

The owner should be able to sort by conservative ROI and confidence, open a product and understand the entire business case without contacting a supplier.

## 31. Primary management rule

**Scale only after precision.**

A database of 500,000 badly matched products is worse than 10,000 well-normalized products.

The implementation order is therefore:

**precision → end-to-end economics → ranking quality → scale.**

## 32. Final success criterion

Mega Product Radar succeeds when it repeatedly surfaces products that remain attractive under conservative public-price economics before any negotiation occurs.

Negotiation, supplier relationships and operational execution are optional value multipliers after discovery — not hidden assumptions inside the discovery model.
