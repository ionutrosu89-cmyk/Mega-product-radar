# G2 Romania Evidence Contract R1

## Objective
Define one truth-safe evidence contract for the Romania benchmark before scaling from 100 to 1,000 products.

## Surfaces

### 1. eMAG Romania — direct marketplace surface
Role: primary Romania marketplace competition and price evidence.

Allowed evidence classes:
- DIRECT_MARKETPLACE_PRODUCT_PRESENCE
- DIRECT_MARKETPLACE_QUERY_SURFACE
- MANUAL_REVIEWED_MARKET_WIDE

Promotion rules:
- query-surface counts are not market-wide counts;
- exact comparable listing/seller counts require reviewed MARKET_WIDE scope;
- product presence alone proves presence, not saturation;
- public listing price is observed marketplace price, not realized sales.

### 2. Trendyol Romania — direct marketplace surface
Role: second Romania marketplace competition and price evidence.

Allowed evidence classes:
- DIRECT_MARKETPLACE_PRODUCT_PRESENCE
- DIRECT_MARKETPLACE_QUERY_SURFACE
- MANUAL_REVIEWED_MARKET_WIDE

Promotion rules are identical to eMAG. Lower bounds such as `656+` remain lower bounds and cannot become exact counts.

### 3. Romania Retail Web — independent Romanian retail/search surface
Role: independent presence/price corroboration across Romanian retail web results or a named Romanian retailer/search surface with explicit provenance.

Allowed evidence classes:
- DIRECT_RETAILER_PRODUCT_PRESENCE
- DIRECT_RETAILER_LISTING_PRICE
- SECONDARY_PUBLIC_SEARCH_INDEX

Hard ceiling:
- this surface can corroborate presence, price and category availability;
- it cannot by itself prove marketplace-wide competition or Romania Gap;
- secondary indexed evidence is never renamed direct/current evidence;
- freshness must be explicit.

This third surface is intentionally capability-based rather than tied to one retailer until a direct, permitted and reproducible source is validated. The exact named source used in each observation must be persisted.

## Required observation fields
Every Romania observation must include:
- canonicalProductId
- surface
- sourceName
- sourceUrl or immutable raw reference where available
- observedAt
- evidenceClass
- freshnessClass
- comparabilityStatus
- comparabilityConfidence
- identitySignals
- variantSignals
- listingCount with countSemantics when present
- sellerCount with countSemantics when present
- priceRon when present
- manualReviewed
- comparableScopeConfirmed
- salesEvidence = NOT_VERIFIED_SALES

## Comparability status
Allowed values:
- EXACT_COMPARABLE
- STRONG_COMPARABLE
- PARTIAL_COMPARABLE
- NON_COMPARABLE
- UNKNOWN

No title-only match can exceed PARTIAL_COMPARABLE.
Variant mismatch forces NON_COMPARABLE or UNKNOWN depending on evidence.
Missing evidence remains UNKNOWN, never zero.

## Freshness
- LIVE_OR_CURRENT: direct observation <= 24h old
- RECENT: >24h and <=7d
- AGING: >7d and <=30d
- STALE: >30d
- HISTORICAL: archival evidence not intended as current state

## Romania Gap promotion ceiling
- sampled/query-surface evidence may support discovery and PROMISING only;
- VALIDATE / FINALIST requires exact comparable Romania evidence according to existing promotion validators;
- the third surface can strengthen confidence but cannot replace exact eMAG + Trendyol comparability when competition is a hard gate.

## R1 benchmark acceptance
For the first 100 products:
- >=20 normalized category families;
- all 100 receive an evidence state on all three surface slots, including UNKNOWN where no evidence exists;
- comparability confidence recorded separately from presence;
- freshness class recorded;
- UNKNOWN rate measured;
- human audit of false positives completed before scaling to 1,000;
- provider spend and paid calls explicitly reported;
- no automated purchase/order authority.
