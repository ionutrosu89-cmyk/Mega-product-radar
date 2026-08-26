# P4 Romania Semantic Comparability V2

Purpose: reduce Romanian marketplace false positives before Romania Gap scoring without inventing equivalence from title similarity.

## Contract

A comparability profile defines a `comparabilityKey`, required observable attributes, inclusion product-type phrases, and explicit exclusion phrases.

Classification states remain:
- EXACT
- COMPARABLE
- NOT_COMPARABLE
- UNKNOWN

## Truth rules

1. Explicit structured attributes or explicit numeric title facts may satisfy or contradict a required attribute.
2. A direct contradiction (for example `2 inele` against required `ringCount = 3`) may classify `NOT_COMPARABLE`.
3. Explicit excluded product types (for example standalone mechanisms) classify `NOT_COMPARABLE`.
4. Title similarity or a generic product noun alone never proves `EXACT`; it remains `COMPARABLE` and requires review.
5. Missing semantic evidence stays `UNKNOWN`.
6. Semantic classification never upgrades query coverage from ESTIMATED to EXHAUSTIVE_QUERY and never converts query-surface zero into market-wide zero.
7. The engine is evidence preparation only: no FINALIST/TEST/BUY promotion, no paid calls, no purchase authority.

## First profile

`THREE_RING_ROUND_RING_BINDERS` requires an explicit ring count of 3 and a binder/biblioraft/dosar product-type signal. Two-ring results and standalone mechanisms are excluded. This formalizes the false-positive pattern already observed in the manual Romania binder review.

## Next step

Extend profiles only where product-defining attributes can be expressed conservatively and tested. Ambiguous categories should remain manual-review-first rather than receiving speculative semantic auto-classification.
