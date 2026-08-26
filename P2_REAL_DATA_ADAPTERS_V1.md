# P2 Real Data Adapters V1

Purpose: route existing committed/public marketplace datasets into `MPR_MARKET_OBSERVATION_V1` and the append-only history engine without inventing identity or facts.

## Supported adapter classes

- Amazon public ranking snapshots (`rankPairs`)
- Amazon explicit BSR snapshots (`bsrEntries`)
- absolute product-detail snapshots containing observed price/review/rating/rank values

## Hard truth rules

1. Canonical binding uses exact `(platform, externalId)` aliases only.
2. Titles never create or infer `canonicalProductId`.
3. Derived deltas (for example `reviewDelta`, `priceDelta`) are not raw observations and cannot be converted into absolute facts.
4. Multiple explicit BSR categories are preserved as separate metric surfaces. No primary BSR is invented.
5. Rank/review/price never become verified sales.
6. Unbound source observations may enter history but remain non-decision-eligible until exact canonical binding exists.
7. Adapters perform no network requests, paid calls or purchase actions.

## Generic longitudinal schedule

Legacy one-off labels such as Round 1 / Round 2 are no longer the target architecture. `MPR_HISTORICAL_SCHEDULER_V1` creates deterministic observation milestones for each exact source series:

- 24h
- 7d
- 30d
- 90d

Windows are anchored to the first observation, so repeated daily snapshots cannot push 7d/30d/90d milestones forward. Series identity remains `(platform, externalId, surface)`, so two BSR categories for the same ASIN are scheduled independently. A schedule item only says `WAITING`, `DUE` or `WINDOW_SATISFIED`; it never executes a provider call and never authorizes spend.

## Canonical measurement run

`MPR_DATA_FOUNDATION_RUN_V1` composes the entire P2 path in one place:

`raw public dataset → exact adapter → MarketObservation → append-only history → Product Universe → history metrics → quality gate → historical schedule`

Unsupported dataset types fail closed. Existing raw datasets are not mutated. Quality targets are management gates, not claims of achieved coverage.

## Scale entry versus 10K milestone

P2 deliberately separates two questions that must not be confused:

1. **May we begin controlled scaling?** Entry gates require at least 1,000 canonical products plus minimum source-identity, price, review and category coverage and an acceptable unbound-observation share.
2. **Have we reached the first serious 10K milestone?** This requires 10,000 canonical products, at least 3,000 products with two or more observations and at least 1,000 products with three or more observations.

The longitudinal 3K/1K targets therefore measure success at the 10K milestone; they do not create an impossible prerequisite before scaling can start.

## Measured repository bootstrap baseline

The committed `data/real-products-1000.compact.json` provides a real 1,000-product **catalogue bootstrap**, not live market history. Its committed metadata supports the following raw-source baseline:

- 1,000 unique Amazon products
- price present for 997 / 1,000 = 99.7%
- reviews present for 1,000 / 1,000 = 100%
- rating present for 1,000 / 1,000 = 100%
- category present for 1,000 / 1,000 = 100%
- source URL identity match for 788 / 1,000 = 78.8%; 212 URL mismatches are preserved as integrity metadata

These values are persisted in `data/p2-source-baseline-2026-08-26-v1.json`.

This is **not** yet canonical coverage. The public bootstrap file does not contain the server-side canonical registry or resolved canonical UUIDs, so canonical product count, bound alias count and 2+/3+ canonical history remain unknown rather than being invented. `planCanonicalBootstrapResolution()` produces an exact-ASIN server-resolution plan and explicitly does not generate canonical UUIDs client-side.

## P2 sequence

1. Reuse adapters for existing datasets. ✅
2. Build a coverage/data-quality report over canonical products + aliases + adapted history. ✅
3. Add generic 24h/7d/30d/90d historical scheduling without automatic execution. ✅
4. Produce one canonical Data Foundation measurement run. ✅
5. Separate controlled-scale entry gates from 10K milestone targets. ✅
6. Measure the committed 1,000-product raw-source baseline without overstating canonical coverage. ✅
7. Resolve exact Amazon aliases against the server canonical registry and measure canonical coverage.
8. Permit controlled scale only when entry gates pass; continue until the 10K milestone gates pass.
