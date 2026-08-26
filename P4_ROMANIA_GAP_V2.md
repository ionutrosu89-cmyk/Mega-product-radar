# P4 Romania Gap V2

Purpose: determine whether a globally interesting product appears underserved on a clearly defined Romanian market surface, without turning broad search counts or incomplete query results into fake market-wide competitor counts.

## Required identity

Decision-eligible Romania Gap evidence requires exact `canonicalProductId` binding. Titles never bind local evidence to a product.

## Coverage classes

Every analysis must declare exactly one coverage class:

- `EXACT` — exact reviewed evidence for the scoped surface, not a market-wide claim.
- `EXHAUSTIVE_QUERY` — the reviewed query result surface is explicitly complete for that query.
- `ESTIMATED` — coverage is estimated or incomplete and can never by itself prove a market gap.

A zero comparable count on a reviewed query surface is not automatically a zero count for the Romanian market.

## Listing comparability

Listings are classified as:

- `EXACT`
- `COMPARABLE`
- `NOT_COMPARABLE`
- `UNKNOWN`

Unknown comparability forces review. Variants are deduplicated before competitor counts are calculated.

## Derived metrics

V2 calculates only from explicit local evidence:

- comparable listing count
- seller count
- brand count
- median comparable price
- review barrier
- price spread
- seller concentration
- local demand score when direct demand evidence exists
- gap score
- confidence

## Gate rules

Romania Gap can return `PASS`, `REVIEW`, or `UNKNOWN`.

`PASS` requires canonical identity, non-estimated coverage, no unresolved listing comparability, supported local demand, sufficient confidence, and a strong derived gap score.

A Romania Gap PASS is only evidence for the canonical Decision Authority. It cannot promote a product directly to FINALIST, TEST_READY, TEST_VALIDATED, BUY_READY, or authorize a purchase.

## Integration verification

This stacked PR is retargeted to `main` only after Trend Intelligence V2 is merged and green. Integration must preserve exact `canonicalProductId` binding and the distinction between reviewed query-surface evidence and market-wide claims.

## Truth safeguards

- broad marketplace result counts are not exact comparable counts
- variants and repeated listings are deduplicated
- `ESTIMATED` never becomes `EXACT`
- query-surface zero != market-wide zero
- local demand is required before low supply can be interpreted as opportunity
- missing facts remain unknown
- no paid provider execution
- no purchase authority
