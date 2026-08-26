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

## P2 sequence

1. Reuse adapters for existing datasets.
2. Build a coverage/data-quality report over canonical products + aliases + adapted history.
3. Gate 1K→10K expansion on duplicate/collision and coverage thresholds.
