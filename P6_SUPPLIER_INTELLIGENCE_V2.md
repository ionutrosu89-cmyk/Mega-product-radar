# P6 Supplier Intelligence V2

Purpose: turn supplier discovery into product-specific, provenance-backed supplier dossiers without treating a listing as a verified supplier.

## Canonical lifecycle

`DISCOVERED → LISTING_OBSERVED → CONTACTED → QUOTE_RECEIVED → DOCUMENTED → MANUALLY_VERIFIED → AGENT_VERIFIED`

A higher state must represent actual evidence progression. Discovery-only rows never satisfy the supplier decision gate.

## Product binding

Every dossier is bound to `canonicalProductId`. Evidence for another product is rejected and cannot be borrowed, even when supplier name, title or marketplace listing looks similar.

## Quote evidence

A decision-usable quote requires at minimum:
- positive unit price
- currency
- positive MOQ
- observedAt
- source/provenance

`DOCUMENTED` and stronger states additionally require strong evidence class: VERIFIED, DIRECT_OBSERVED, PROVIDER_VERIFIED or MANUALLY_VERIFIED. Quotes are freshness-bound; default maximum age is 90 days unless explicitly configured.

## Initial gate

Default serious-validation requirements:
- at least 3 distinct supplier dossiers for the product
- at least 2 suppliers with current quote evidence
- at least 1 documented strong-evidence quote
- at least 1 manually verified current quote before PASS

This supports the first milestone of 20 products × 3 supplier dossiers and later 100 × 3. The milestone is a development target, not a claim that those dossiers already exist.

## Integration verification

This stacked PR is retargeted to `main` only after Importability V2 is merged and green. Integration must preserve exact canonical product binding, quote provenance and freshness, supplier deduplication, and the rule that supplier evidence never grants purchase authority.

## Safety

Supplier Intelligence is evidence only. It cannot promote FINALIST/TEST/BUY by itself, cannot authorize purchase, and triggers no paid calls or agent actions.
