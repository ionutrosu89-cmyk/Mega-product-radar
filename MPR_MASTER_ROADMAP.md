# Mega Product Radar — Master Development Roadmap

This document is the canonical roadmap for Mega Product Radar. When deciding what to build next, compare current work against this plan first.

## Product strategy

Mega Product Radar is one intelligence platform with four access levels, not four separate products.

### FREE — What is selling now?
Goal: give every user a large, useful market/product database by category and niche.

Core capabilities:
- Category Universe: category → subcategory → niche → micro-niche
- Product Universe designed for 100k+ normalized products
- product, brand, seller and category relationships
- Top Products by category/niche
- estimated sales, revenue, price, rating, reviews, rank/BSR, review velocity, growth, trend and confidence
- historical observations rather than overwriting the latest value
- marketplace/source provenance

Primary benchmark inspiration: SmartScout + SellerSprite + Keepa + Helium 10 product research.

### DISCOVER — Where can I source it and does the economics work?
Includes FREE plus:
- Supplier Intelligence
- supplier candidates and evidence
- quote history
- MOQ, price tiers, samples, shipping, DDP, lead time, logistics, Trade Assurance, customs/compliance evidence
- Supplier Benchmark Engine
- Landed Cost
- margin, profit, ROI, break-even price and maximum acceptable supplier/landed cost
- strict distinction between SUPPLIER_STATED / DOCUMENTED / VERIFIED / ESTIMATED data

Primary benchmark inspiration: Jungle Scout Supplier Database + ImportYeti + MPR Supplier Evidence Database / Economics Engine.

### RADAR — What opportunity is emerging?
Includes FREE + DISCOVER plus:
- Rising Products
- Rising Keywords
- New Product Radar
- trend acceleration
- search/review/rank velocity
- Romania demand intelligence
- Romania seller/listing density
- price gap / seller gap / competition gap
- Romania Gap Score
- Opportunity Score combining global demand, growth, Romania Gap, supplier availability, economics and confidence
- watchlists and opportunity alerts

Primary benchmark inspiration: Exploding Topics + SellerSprite opportunity/keyword intelligence + Jungle Scout Opportunity Finder + Google Trends + proprietary MPR Romania intelligence.

### LAUNCH — How do I turn the opportunity into a business?
Includes FREE + DISCOVER + RADAR plus:
- Launch Academy România
- interactive business setup roadmap
- SRL/PFA, CAEN, VAT, EORI and startup checklists
- accounting, banking and cashflow guidance
- marketplace onboarding: eMAG / Trendyol / Amazon / own site
- sourcing China, RFQ, MOQ and negotiation
- import: DDP / FOB / EXW / freight / customs / VAT
- compliance: GPSR / CE / EPR / labeling / documentation
- logistics, fulfillment, courier, returns and packaging
- listing, SEO, images and marketing
- verified partner ecosystem: accountant, company setup, courier, fulfillment, integrations, China sourcing agent, freight forwarder, product services

Primary benchmark inspiration: Helium 10 Freedom Ticket / Academy + Jungle Scout Academy, localized and operationalized for Romania.

## Core development principle

Build in this order:

DATA → INTELLIGENCE → DECISION → EXECUTION

Do not prioritize auto-buy, auto-order, native mobile apps, complex AI assistants or cosmetic features ahead of the data foundation.

## Development phases

### Phase 0 — Product realignment
- freeze this four-tier strategy
- align navigation and entitlements
- classify existing features as KEEP / MOVE / DEPRECATE
- keep TEST/HOLD/BUY safeguards, but do not make purchase execution the current development focus

### Phase 1 — Product & Market Data Foundation
Priority #1.

1. Category Universe
2. Product Universe
3. Seller & Brand Graph
4. FREE Top Products Engine

Architecture target: 100,000+ normalized products, loaded progressively.

FREE ranking should support Top 20 / Top 50 / Top 100 by category/niche using an MPR Market Score based on sales, revenue, review velocity, rank stability, growth and data confidence.

### Phase 2 — Supplier Intelligence
- Supplier Evidence Database
- structured supplier identity and quote history
- Supplier Benchmark Engine
- price / MOQ / DDP / lead time / documentation benchmarks
- evidence history must remain append-only where possible

### Phase 3 — Economics Engine
- supplier + freight + fees + taxes + ads + returns
- landed cost
- profit/unit
- margin
- ROI
- break-even price
- maximum acceptable supplier/landed cost

Output should be commercial intelligence such as GOOD ECONOMICS / MARGINAL / NEGOTIATE / POOR ECONOMICS, not an automatic BUY instruction.

### Phase 4 — Trend Intelligence
- rising products
- rising keywords
- new products
- review acceleration
- rank acceleration
- seller/brand momentum

### Phase 5 — Romania Intelligence
For product/keyword, combine global demand with:
- Romanian search volume
- trend
- marketplace listings
- seller count
- prices
- review barrier
- seller concentration
- local competition

Primary output: Romania Gap Score.

### Phase 6 — Opportunity Engine
Combine:
- global demand
- growth
- Romania Gap
- competition
- supplier availability
- economics
- data confidence

Primary output: MPR Opportunity Score.

### Phase 7 — Alerts & Radar Feed
- new opportunity alerts
- rising demand alerts
- Romania Gap alerts
- low local seller density alerts
- favorable supplier benchmark alerts
- watchlist

### Phase 8 — Launch Academy România
Interactive checklist/roadmap rather than a passive article library.

### Phase 9 — Launch Partner Network
Verified partners and services for accounting, company setup, courier, fulfillment, integrations, China sourcing, freight and related launch services.

### Phase 10 — Personalization
Use onboarding data such as budget, marketplace and product constraints to generate “Top products for you”, not only generic rankings.

### Phase 11 — Feedback Loop
Compare MPR predictions with real outcomes and calibrate margin, ads, returns, shipping and recommendation accuracy.

### Phase 12 — Scale
Only after product-market usefulness is proven:
- 500k–1M products
- additional marketplaces/countries
- API
- B2B/enterprise intelligence

## Strict sprint order

1. Category Universe
2. Product Universe
3. Top Products FREE
4. Seller & Brand Intelligence
5. Supplier Database
6. Supplier Benchmark
7. Economics
8. Trend Engine
9. Romania Gap
10. Opportunity Engine
11. Alerts
12. Launch Academy

## Data milestones

### Product database
- Milestone A: 10,000 products — FREE becomes meaningfully useful
- Milestone B: 50,000 products — category/niche rankings become stronger
- Milestone C: 100,000 products — serious market-intelligence foundation

### Supplier database
Initial target:
- 100 products
- minimum 3 suppliers per product
- 300 structured supplier quotes

### Romania intelligence
Initial target:
- 1,000 products with Romanian keyword/demand/competition/seller/price coverage

## 90-day objective

By the end of the next major 90-day development cycle:
- FREE: thousands/tens of thousands of products and useful category rankings
- DISCOVER: Supplier Intelligence + Economics
- RADAR: initial Romania Gap + Rising Products
- LAUNCH: Academy structure + first operational modules

## Competitive synthesis

MPR should not aim to be “Helium 10 for Romania”. The target synthesis is:

SmartScout + SellerSprite + Keepa
for market/product intelligence

+
Exploding Topics
for trend discovery

+
Jungle Scout + ImportYeti
for supplier intelligence

+
MPR Romania Gap
for local opportunity detection

+
MPR Economics
for landed cost / margin / ROI

+
Launch Academy România
for execution.

## Differentiating promise

Competitors often answer: “this product is selling.”

MPR should answer:

“This product has global demand, is growing, has Romanian demand, relatively few relevant local sellers, a supplier benchmark of X, an expected landed-cost range of Y, and an economics profile of Z at the current Romanian selling price.”

## Current development rule

Before starting a new feature, answer:
1. Which phase above does it belong to?
2. Does it improve DATA, INTELLIGENCE, DECISION or EXECUTION in the planned sequence?
3. Does an earlier unfinished phase have higher priority?
4. Does it preserve evidence/confidence labels and strict commercial gates?

If a proposed feature does not support this roadmap, defer it unless there is a compelling product reason to revise the roadmap itself.
