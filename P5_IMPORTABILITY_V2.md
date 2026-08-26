# P5 Importability V2

Importability V2 is a canonical, evidence-driven gate for whether a product can safely continue toward supplier and economics validation.

Decision-eligible evidence must be bound to `canonicalProductId`. Critical facts remain unknown until supported by VERIFIED, DIRECT_OBSERVED, PROVIDER_VERIFIED, or MANUALLY_VERIFIED evidence. Heuristic or stale evidence cannot silently pass.

Hard blockers include liquids, regulated or special-authorization products, dangerous goods, explicit air-freight unsuitability, overweight units, and excessive packed volume. Battery and near-limit logistics remain REVIEW rather than PASS.

## Integration verification

This stacked PR is retargeted to `main` only after Romania semantic comparability is merged and green. Integration must preserve fail-closed critical facts, canonical identity binding, freshness checks, zero paid calls, and zero purchase authority.
