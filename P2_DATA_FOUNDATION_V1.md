# Mega Product Radar — P2 Data Foundation V1

Status: ACTIVE.

P2 scales the canonical data graph built in P1. It must not create parallel identity, evidence or decision models.

## Product Universe V1

A product enters the canonical universe only with a valid canonical UUID. Marketplace identities are aliases keyed by exact `(platform, externalId)`. Titles are labels and may never auto-merge products.

Product Universe V1 reports coverage for:

- direct source identity;
- price observations;
- review observations;
- category identity;
- products with >=2 observations;
- products with >=3 observations;
- bound vs unbound observations;
- duplicate/collision truth gates.

Unbound observations remain useful for discovery diagnostics but are non-decision-eligible until explicitly linked to a canonical product.

## P2 scale targets

First milestone:

- 10,000 canonical products;
- >70% with direct source identity;
- >60% with observed price;
- >60% with observed review count where the source exposes it;
- >90% category identity;
- 3,000 products with >=2 longitudinal observations;
- 1,000 products with >=3 observations;
- source alias collision rate = 0;
- duplicate canonical product ID rate = 0.

These are management targets, not claims about current coverage.

## Execution order

1. Product Universe + coverage metrics.
2. Adapters from existing real public product/observation datasets into canonical contracts.
3. Append-only ingestion into MarketObservation History.
4. Quality gates for missingness, freshness, collisions and longitudinal depth.
5. Expand from current universe toward 10K while keeping paid-provider execution disabled by default.

Truth rules remain unchanged: missing stays missing; public proxies do not become verified sales; no title-based joins; no automatic purchase authority.