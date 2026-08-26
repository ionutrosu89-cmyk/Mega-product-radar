# P8 Opportunity V5

Purpose: combine the evidence layers into one explainable product-opportunity view without allowing a high score to bypass failed gates.

## Weights

- Global Demand: 20
- Trend: 15
- Romania Gap: 25
- Importability: 10
- Supplier: 10
- Economics: 15
- Evidence: 5

Total = 100.

The weights are an explainable starting contract and must later be calibrated against measured beta outcomes. Opportunity score and confidence remain separate.

## Identity rule

Every supplied evidence envelope must refer to the same `canonicalProductId`. Cross-product evidence is rejected. Product titles never bridge identity.

## Missing evidence

Missing components remain missing. They never default to zero, PASS or an inferred value. A complete Opportunity score is emitted only when all weighted components are available.

## Gate precedence

A high score never bypasses the pre-test gates. FINALIST requires all of the following to be PASS for the same canonical product:

- Trend
- Romania Gap
- Importability
- Supplier
- Economics

It also requires sufficient aggregate confidence and opportunity score. Importability BLOCKED and any other unresolved/review gate prevent FINALIST regardless of score. Low aggregate confidence remains `VALIDATE` even when the Opportunity Score is high.

## Funnel authority

Opportunity V5 may recommend:

`DISCOVERED → PROMISING → VALIDATE → FINALIST`

It cannot produce TEST_READY, TEST_RUNNING, TEST_VALIDATED or BUY_READY. Those require measured test evidence and the canonical Decision Authority.

Legacy score/BUY recommendations are explicitly non-authoritative.

## Integration verification

This stacked PR is retargeted to `main` only after Economics V3 is merged and green. Integration must preserve canonical identity, score/confidence separation, gate precedence, fail-closed low-confidence behavior, and the single Decision Authority boundary.

## Safety

- verified sales are never inferred
- purchaseAuthorized = false
- automaticPurchaseAllowed = false
- paidCallsTriggered = 0
- providerSpendEur = 0
