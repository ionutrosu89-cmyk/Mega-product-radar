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

Each required input must carry strong evidence: VERIFIED, DIRECT_OBSERVED, PROVIDER_VERIFIED or MANUALLY_VERIFIED. The supplier quote does not silently substitute for the dedicated `supplierUnitCost` evidence input.

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

## Integration verification

This stacked PR is retargeted to `main` only after Supplier Intelligence V2 is merged and green. Integration must preserve explicit cost evidence, canonical quote binding, fail-closed unknowns, and zero purchase authority.


## Romania market profile and transport economics

The launch market is Romania. Import VAT is supplied by the active market profile and is currently configured at 21%; the value is configuration, not a formula constant. Inactive future country profiles remain unverified until explicitly activated.

Transport economics must use one of two evidence-backed paths:

- a verified total freight quote; or
- a carrier/service rate with packaging geometry and actual gross weight.

For weight-rated express/air/rail transport, chargeable weight is the greater of actual gross weight and volumetric weight. Volumetric weight requires the carrier/service divisor as evidence; MPR must never assume one universal divisor.

For sea freight, CBM is calculated from carton dimensions and carton count. Product dimensions may come from a direct product page, but transport confirmation requires carton/package dimensions or a verified total freight quote.

Customs duty is product-specific and remains UNKNOWN until HS/CN classification, origin and the applicable official tariff evidence are known. A supplier's estimate must not become verified customs duty.

Import VAT is calculated separately from customs duty. Cash landed cost includes import VAT. Economic landed cost may exclude recoverable import VAT only when the VAT treatment is explicitly verified.

## Seller economics consistency

Selling prices are treated as gross consumer prices when gross-price fields are used. VAT must be extracted as gross minus net revenue; it must not be calculated as gross price multiplied by the VAT rate and then subtracted again.

Seller economics should expose at minimum:
- gross selling price
- net revenue
- marketplace commission
- ads reserve
- returns reserve
- fulfilment
- payment/warranty/overhead reserves where applicable
- profit per unit
- margin
- ROI
- break-even selling price

All decision-critical economics must use the same VAT and landed-cost semantics as the customer-facing calculator.
