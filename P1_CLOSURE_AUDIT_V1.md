# Mega Product Radar — P1 Domain Architecture Closure Audit V1

Status: CLOSED when this document is merged with green CI.

## Scope closed

P1 establishes the canonical domain foundation required before scale work:

- Canonical product UUID is the only decision-critical cross-module identity.
- Product aliases preserve marketplace external IDs without title-based auto-merge.
- Supplier, landed economics, RFQ/Sourcing Ops, portfolio and feedback decision handoffs are canonical-bound.
- Legacy title-keyed records remain compatibility-readable only and cannot satisfy decision gates.
- MarketObservation V1 preserves direct source identity, nullable facts and provenance.
- MarketObservation History V1 is append-only, rejects exact duplicates and computes longitudinal metrics only within the same source identity.
- Evidence classes are explicit and stronger classes cannot be assigned silently.
- Cross-product evidence borrowing is rejected fail-closed.
- Domain decisions cannot grant purchase authority.

## Exit criteria

P1 is considered closed only if CI proves that the canonical contracts, MarketObservation, history engine and commercial identity bridge remain importable and that the core fail-closed policies remain present.

## Handoff to P2

P2 Data Foundation may now scale product coverage and longitudinal history, but must reuse these contracts rather than creating parallel identity or evidence models.

Initial P2 priorities:

1. Product Universe V1 with canonical product + alias deduplication.
2. Coverage KPIs for source identity, price, review count, category and longitudinal depth.
3. Append-only observation ingestion into generic MarketObservation History.
4. 1K → 10K canonical product expansion without paid-provider execution by default.
5. Data quality gates: duplicate rate, missingness, freshness and decision-eligible share.

Non-negotiable rules remain: missing stays missing; no verified-sales inference from public proxies; no title-based identity; no automatic purchase authority; paid calls require separate authorization.