# Mega Product Radar — P1 Domain Architecture V1

Status: ACTIVE P1 foundation after P0 Core Reset.

## Canonical domain chain

`CanonicalProduct → ProductAlias → MarketObservation/Evidence → Trend → Romania Market → Supplier Evidence → Importability → Economics → OpportunityDecision`

## Identity rule

`canonicalProductId` (UUID) is the only cross-module product identity for decision-critical records. Product names and titles are labels. A title match across marketplaces is never sufficient for automatic merge.

## Evidence contract

Every decision-critical evidence item must carry:

- `canonicalProductId`
- `value` (nullable; missing stays missing)
- `observedAt`
- `source`
- `sourceUrl` when available
- `evidenceClass`
- `confidence` when measured
- `freshness` when classified

Evidence classes: `VERIFIED`, `DIRECT_OBSERVED`, `PROVIDER_VERIFIED`, `MANUALLY_VERIFIED`, `DERIVED`, `ESTIMATED`, `HEURISTIC`, `UNKNOWN`.

A stronger evidence class cannot be assigned silently. Promotion requires an explicit review/verification operation and its provenance.

## Decision contract

One `OpportunityDecision` belongs to one canonical product. Evidence from another canonical product is rejected fail-closed. Domain decisions cannot authorize automatic purchase.

Canonical stages remain:

`DISCOVERED → PROMISING → VALIDATE → FINALIST → TEST_READY → TEST_RUNNING → TEST_VALIDATED → BUY_READY`

`BLOCKED` and `REVIEW` are explicit non-promotional states.

## Migration strategy

This P1 contract is introduced before broad legacy migration. Existing `productName` fields remain display/backward-compatibility fields temporarily, but they must not become the join key for new decision-critical code. Subsequent P1 PRs will migrate supplier, economics, RFQ, portfolio and feedback persistence to canonical identity and add adapters where legacy data cannot yet be mapped safely.

## Non-negotiable truth rules

- Missing stays missing.
- No cross-platform title auto-merge.
- No cross-product evidence borrowing.
- No silent evidence upgrade.
- No estimated sales relabelled as verified sales.
- No automatic purchase authority.
- Paid-provider execution remains separately gated and is not authorized by this architecture.
