# P7 Economics V3

Purpose: calculate landed and selling economics for one canonical product using a product-matched supplier quote and explicit cost evidence. Missing critical costs never default to zero.

## Required cost inputs

- supplier unit cost
- international freight per unit
- customs per unit
- broker per unit
- VAT per unit
- domestic logistics per unit
- packaging per unit
- marketplace fee %
- fulfillment per unit
- returns %
- ads %
- payment fee %
- warranty %

Each required input must carry strong evidence: VERIFIED, DIRECT_OBSERVED, PROVIDER_VERIFIED or MANUALLY_VERIFIED.

## Product identity

The supplier quote must have an identifier and the same `canonicalProductId` as the Economics run. A quote from another product is rejected rather than borrowed.

## Scenarios

V3 computes BEST / BASE / WORST. Scenario changes are explicit assumptions. They do not rewrite the underlying evidence.

Outputs include:
- fixed unit cost
- variable cost percentage
- break-even sell price
- total unit cost at target selling price
- unit profit
- margin percentage
- break-even supplier unit cost

Break-even and margins are DERIVED economics, not verified sales evidence.

## Gate

Unknown or weak critical cost evidence => `UNKNOWN_FAIL_CLOSED`.

Complete economics below configured margin thresholds => `REVIEW`.

Only complete, strong-evidence economics meeting base and worst-case margin thresholds => `PASS`.

Economics never authorizes purchase and cannot independently promote FINALIST / TEST_READY / BUY_READY.
