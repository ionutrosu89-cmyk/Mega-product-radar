# First Finalist evidence KPI refresh — 2026-08-31

Evidence-only checkpoint for the First Finalist Program. This file does not promote proxy evidence into stronger evidence classes.

## Truth policy

- unknown != zero
- review/rank != verified sales
- sampled Romania != exact Romania enumeration
- supplier public listing != verified quote
- verified quote != confirmed landed cost
- no purchase or negotiation is authorized by this checkpoint
- paid provider calls triggered by this checkpoint: 0

## Current leader

The current First Finalist leader remains Amazon ASIN `B08BJHMY33` (oversized cotton beach towels, 4-pack family). Existing project evidence has a confirmed acceleration signal, but that signal is not verified sales.

## Eight evidence KPIs

| KPI | Current evidence-backed state | Gate to advance |
| --- | --- | --- |
| Products with confirmed trend fusion | >=1 | Preserve independent rank/review evidence and provenance; do not reinterpret as verified sales. |
| Products with exact Romania Gap | 0 | Complete approved-alias, market-wide enumeration for the target product family on required Romanian marketplaces, deduplicate listings, classify each result, preserve timestamps/source evidence, and satisfy market-coverage confirmation. |
| Products with verified supplier package | 0 | Obtain a direct comparable supplier response for the exact target configuration, including unit price, MOQ, Incoterm, carton dimensions/weight, lead time, and configuration/specification confirmation. |
| Products with confirmed landed economics | 0 | Requires verified supplier package plus confirmed freight/import/tax/VAT/fee inputs and evidence-backed sell-price assumptions; verified quote alone is insufficient. |
| PROMISING | >=1 | Existing leader may remain PROMISING while downstream gates are unresolved. |
| VALIDATE | 0 | Requires the program's evidence gates to advance beyond proxy/sample states; no promotion from sampled Romania or public supplier listings. |
| FINALIST | 0 | Requires all Opportunity V4 finalist gates to pass on evidence, including exact Romania Gap, verified sourcing package and confirmed landed economics. |
| TEST_READY | 0 | Requires a legitimate FINALIST/approved downstream commercial gate; this checkpoint authorizes no purchase. |

## Open First Finalist blockers reviewed

- #215 — Romania Gap: blocked on exact market-wide enumeration. Existing manual/search evidence is sampled only.
- #216 — supplier package: blocked on direct supplier evidence for the exact target configuration. Existing public listings remain preflight evidence only.
- #217 — landed economics: blocked by #215 and #216 plus confirmed freight/import/tax/VAT/marketplace-fee evidence.
- #218 — Opportunity V4 / First Finalist: remains blocked until upstream evidence gates pass.
- #220 — autonomous orchestrator: may continue zero-cost technical/evidence work but must stop at manual, paid, negotiation or purchase boundaries.
- #219 — scale/ranking: does not override First Finalist evidence gates.

## Next eligible zero-cost step executed

This KPI refresh is the next safe repository data/evidence step: it synchronizes the First Finalist checkpoint with the current open blockers without fabricating progress. No provider call, RFQ, negotiation, order or purchase was made.

## Exact external/manual evidence now required

### A. Romania exact-enumeration package

For the target `OVERSIZED_COTTON_BEACH_TOWELS_4_PACK` family:

1. Freeze and manually approve the complete alias/query set before enumeration.
2. Enumerate all result pages required by the exact-evidence protocol for each required Romanian marketplace (currently eMAG and Trendyol in the First Finalist evidence path).
3. Preserve query, page/result position, listing URL/ID, seller where observable, timestamp and raw capture/source reference.
4. Deduplicate identical listings across aliases/pages.
5. Classify each listing against the exact target specification; ambiguous rows remain unresolved, never assumed non-match.
6. Record explicit market-coverage completion. Only then may Romania Gap move from sampled/proxy to exact under the project protocol.

### B. Verified supplier-package evidence

Obtain direct supplier evidence for the exact 4-pack oversized cotton beach towel configuration, with at minimum:

- exact dimensions/material/GSM or other agreed specification;
- 4-piece pack confirmation;
- unit/set price and currency at target order quantity;
- MOQ;
- EXW/FOB and/or offered Incoterm;
- carton quantity, carton dimensions and gross/net weight;
- production/lead time;
- supplier identity and timestamp/source reference;
- DDP Romania only if explicitly quoted for the target shipment — company-level DDP capability is not a Romania DDP quote.

### C. Confirmed landed-economics evidence

After B exists, resolve freight, customs classification/duty, import VAT treatment, brokerage/handling/domestic transport, packaging/compliance reserves, marketplace commission/fulfillment/ads/returns/warranty/other reserves and FX with provenance. Until these inputs are evidence-backed, confirmed landed economics remains 0.

## Stop condition

The autonomous zero-cost path is now evidence-blocked: the next material promotion requires manual/external evidence from A and/or B. The system must not fabricate completion and must not trigger paid providers, supplier negotiation, RFQ sending, or purchases without explicit user authorization.