# First Finalist evidence KPI refresh — 2026-09-05

Evidence-only checkpoint for the First Finalist Program after the latest V2 demand/competition/opportunity scoring work landed on `main`.

## Truth policy

- unknown != zero
- review/rank != verified sales
- sampled Romania != exact MARKET_WIDE Romania evidence
- supplier listing != verified quote
- verified quote != confirmed landed cost
- issue state alone is not evidence and cannot promote a KPI
- scoring/ranking cannot override failed hard evidence gates
- provider spend triggered by this checkpoint: 0
- purchase / order / negotiation authorized by this checkpoint: false

## Latest verified program evidence

### Confirmed longitudinal trend
`data/amazon-trend-fusion-replay-b08bjhmy33-2026-08-29-v1.json` remains the strongest persisted First Finalist trend evidence:
- candidate: Amazon ASIN `B08BJHMY33`
- status: `CONFIRMED_ACCELERATION`
- confirmed trend-fusion products: 1
- review delta: +1 over ~96.9h
- explicit BSR improved in both Home & Kitchen and Beach Towels over ~70.1h
- sales evidence remains `NOT_VERIFIED_SALES`
- no Romania, supplier, economics or purchase promotion is implied

### Romania exactness
The active exact-comparability family remains:
`OVERSIZED_COTTON_BEACH_TOWELS_4_PACK`.

Persisted manual evidence is still `MANUAL_SAMPLED`, not MARKET_WIDE. The canonical query-union assessment still fails closed with:
- `NON_EXACT_ALIAS_ENUMERATION`
- `ALIAS_SET_NOT_MANUALLY_APPROVED`
- `MARKET_COVERAGE_NOT_CONFIRMED`

Therefore exact comparable listing counts remain unknown and `nichesWithExactRomaniaGap=0`.

### Supplier verification
Issue #216 is currently closed, but no persisted evidence proves its acceptance criteria were met. The latest product-specific supplier evidence for B08BJHMY33 still says:
- `supplierPackageVerified=false`
- public supplier listings are `PUBLIC_LISTING_ONLY_NOT_VERIFIED_QUOTE`
- RFQ intake is `AWAITING_DIRECT_SUPPLIER_RESPONSE`
- exact 4-pack commercial quote, direct price, Incoterm and DDP Romania remain unverified

Issue closure is therefore treated as workflow/administrative state only, not as evidence. The supplier KPI remains 0 until >=3 complete comparable direct quotes exist and at least one passes MANUALLY_VERIFIED.

### Confirmed economics
`data/landed-economics-preflight-b08bjhmy33-2026-08-29-v1.json` remains preflight-only:
- confirmed landed economics: false
- supplier package not verified
- exact Romania Gap not confirmed
- quote price unknown
- freight/DDP unknown
- exact CN/TARIC classification and duty unknown
- exact comparable Romania sell price unknown
- operating fees/reserves not confirmed

No null or unknown input is treated as zero.

### New V2 scoring/ranking layer
The latest `main` contains normalized demand scoring, scoped competition scoring, explainable Opportunity/Confidence scoring, dashboard dataset generation and an end-to-end V2 opportunity runner.

These are valid zero-cost architecture improvements, but they are decision/ranking layers only. They do not create:
- exact MARKET_WIDE Romania evidence
- direct verified supplier quotes
- confirmed landed economics
- verified sales

They therefore cannot promote a candidate through the First Finalist hard gates by score alone.

## Eight evidence KPIs

| KPI | Evidence-backed state | Reason |
| --- | ---: | --- |
| Products with confirmed trend fusion | **1** | B08BJHMY33 has persisted strict rank+review `CONFIRMED_ACCELERATION`; NOT_VERIFIED_SALES. |
| Niches with exact Romania Gap | **0** | Current eMAG + Trendyol evidence is sampled/non-exhaustive; MARKET_WIDE scope and exact counts remain unconfirmed. |
| Products with verified supplier package | **0** | #216 is closed but persisted evidence still has no >=3 complete direct comparable quotes and no MANUALLY_VERIFIED target package. |
| Products with confirmed landed economics | **0** | Upstream Romania/supplier gates and required cost/provenance inputs are incomplete. |
| PROMISING products | **>=1** | Confirmed trend plus sampled Romania support can sustain PROMISING only. |
| VALIDATE products | **0** | Exact Romania evidence is required before VALIDATE under the First Finalist contract. |
| FINALIST products | **0** | Requires confirmed trend + exact Romania + verified supplier + confirmed economics simultaneously. |
| TEST_READY products | **0** | No legitimate FINALIST exists and TEST_READY never implies purchase authorization. |

## Open/closed First Finalist issues

- #214 — OPEN: trend-fusion coverage program. At least one confirmed fusion product exists, but the broader coverage objective remains open.
- #215 — OPEN: first exact comparable Romania Gap niche. This is the current primary evidence blocker.
- #216 — CLOSED, but **not evidence-complete based on persisted repository facts**. Closure does not increment the supplier KPI.
- #217 — OPEN: confirmed landed cost/economics.
- #218 — OPEN: first legitimate Opportunity V4 FINALIST.

## Next eligible zero-cost step executed

This checkpoint reconciles the First Finalist evidence state with:
1. the latest persisted candidate evidence;
2. the current GitHub issue states;
3. the new V2 scoring/ranking architecture.

It specifically prevents the closed state of #216 or the presence of a stronger scoring engine from being misinterpreted as commercial evidence.

No additional automatic zero-cost collection currently available in the repository can legitimately satisfy #215 because the missing requirement is human-confirmed exhaustive comparable MARKET_WIDE evidence.

## Exact next evidence required

### Primary blocker — #215 Romania exact comparable niche

For `OVERSIZED_COTTON_BEACH_TOWELS_4_PACK`:

1. Human-approve the canonical definition and complete alias/query set before counting.
2. Open the direct eMAG and Trendyol query surfaces.
3. Enumerate every relevant result page required to establish complete coverage.
4. Record listing URL/ID, query alias, page/position, timestamp and seller where observable.
5. Deduplicate the same listing across aliases/pages.
6. Open ambiguous results and classify every candidate as exact-comparable / non-comparable / UNKNOWN.
7. Preserve UNKNOWN where evidence is insufficient.
8. Confirm MARKET_WIDE scope manually on both marketplaces.
9. Record exact comparable counts separately from raw surface counts.
10. Run the canonical promotion report; only `PROMOTABLE` may increment the Romania KPI.

### Supplier gate after #215

For the exact same canonical specification, obtain >=3 direct comparable supplier quotes with supplier identity/provenance, exact product configuration, MOQ, unit/set price and currency, sample terms, lead time, 4-pack packing, carton dimensions/weight, EXW/FOB, Romania shipping/DDP where actually quoted, quote date/validity and compliance status. At least one must pass MANUALLY_VERIFIED. Public listings do not satisfy this gate.

### Economics gate after supplier verification

Resolve explicit FX, freight/DDP, CN/TARIC classification, duty, import VAT treatment, brokerage/handling/domestic transport, packaging/compliance, marketplace commission/fulfilment, ads/returns/warranty/other reserves and an observable comparable Romania sell-price scenario. Only then may confirmed landed cost, profit/unit, margin, ROI and break-even be calculated.

## Stop condition

The program is now externally evidence-blocked at #215. Do not trigger paid providers, supplier outreach, RFQ sending, negotiation, ordering or purchase without explicit user approval. Do not convert issue state, sampled counts, ranking scores, supplier listings or estimates into stronger evidence classes.
