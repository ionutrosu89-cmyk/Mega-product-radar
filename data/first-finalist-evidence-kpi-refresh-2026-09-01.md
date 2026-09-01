# First Finalist evidence KPI refresh — 2026-09-01

Evidence-only checkpoint for the First Finalist Program after the truth-first decision engine, Romania evidence queue, importability gate/evidence registry, and importability review-readiness queue landed on `main`.

## Truth policy

- unknown != zero
- review/rank != verified sales
- sampled or multi-surface Romania evidence != exact MARKET_WIDE Romania evidence
- supplier public listing != verified quote
- verified quote != confirmed landed cost
- human-review readiness != importability approval
- FINALIST != TEST_READY and never authorizes purchase
- paid provider calls triggered by this checkpoint: 0
- purchase / order / negotiation authorized by this checkpoint: false

## Current First Finalist program state

Issue #218 remains open. Its acceptance path is still: confirmed longitudinal trend fusion -> exact comparable Romania Gap -> verified supplier package -> confirmed landed economics -> Opportunity V4 FINALIST with sufficient provenance and without compatibility shortcuts.

Since the 2026-08-31 checkpoint, the repository added a truth-first decision engine and additional evidence routing controls. These changes improve routing/readiness but do not promote any candidate across the First Finalist gates by themselves.

## Eight evidence KPIs

| KPI | Evidence-backed state | Gate to advance |
| --- | --- | --- |
| Products with confirmed trend fusion | >=1 | Preserve independent longitudinal rank/review evidence and provenance; never reinterpret the signal as verified sales. |
| Products with exact Romania Gap | 0 | Complete direct, exact, manually reviewed, comparable MARKET_WIDE eMAG + Trendyol evidence under the same canonical comparability key; sampled/multi-surface evidence remains insufficient. |
| Products with verified supplier package | 0 | Obtain >=3 complete comparable direct quotes for the same canonical specification; at least one must reach MANUALLY_VERIFIED under the strict verifier. |
| Products with confirmed landed economics | 0 | Requires a complete verified supplier quote plus explicit FX, freight/DDP, customs/duty/tax/compliance, market sell-price and reserve inputs with provenance; missing costs remain unknown. |
| PROMISING | >=1 | PROMISING may be supported by current trend/proxy evidence but cannot bypass Romania/supplier/economics gates. |
| VALIDATE | 0 | Exact Romania evidence is a prerequisite; sampled Romania and public supplier listings cannot promote to VALIDATE. |
| FINALIST | 0 | Requires all Opportunity V4 finalist gates to pass legitimately and shortlist cap <=3. |
| TEST_READY | 0 | Requires a legitimate downstream commercial approval after FINALIST; no purchase authority is implied. |

## Open First Finalist issues refreshed

- #215 — exact Romania Gap: OPEN. Requires canonical eMAG + Trendyol snapshots, same comparability key, direct source URLs, manual MARKET_WIDE confirmation, exact listing counts and a PROMOTABLE report. Sampled evidence can support PROMISING only.
- #216 — verified supplier package: OPEN. Requires >=3 complete comparable quotes for the same specification, supplier identity/provenance, MOQ, unit price, sample terms, lead time, Romania shipping/DDP terms, currency and compliance status; at least one quote must be MANUALLY_VERIFIED. Public listing prices/partials cannot satisfy the gate.
- #217 — confirmed landed economics: OPEN. Requires a complete verified quote plus explicit FX, freight/DDP, duty/customs/tax/compliance, confirmed landed cost/unit and observable-market sell-price scenario. Missing inputs remain unknown and block confirmation.
- #218 — first legitimate Opportunity V4 FINALIST: OPEN. Remains blocked until #215, #216 and #217 are satisfied on sufficient provenance.

## Latest zero-cost technical/data progress now incorporated

The following merged controls improve the path but do not change the KPI counts above:

1. Truth-first intelligence decision engine and calibration now keep UNKNOWN explicit and separate trend, Romania, importability and economics readiness.
2. Romania truth gate enforces current exact MARKET_WIDE evidence on at least two comparable Romania surfaces before economics can be requested.
3. Importability V2 introduces conservative review classes for bulky, fragile and brand/variant-sensitive products.
4. Audited importability evidence registry records dimensions, weight, material, certifications, brand/variant and explicit human decisions; only human-verified PASS/REJECT can override heuristics.
5. Romania manual evidence priority queue routes products needing second-surface/manual evidence without claiming market-wide absence.
6. Importability review-readiness queue marks only evidence completeness. READY_FOR_HUMAN_IMPORTABILITY_REVIEW is not approval and cannot create FINALIST/BUY/purchase authority.

## Next eligible zero-cost step executed

This checkpoint synchronizes the First Finalist evidence program with the latest intelligence/importability architecture. It is a repository-only evidence/data step with zero provider spend and zero external side effects.

No legitimate automatic promotion is available from the current evidence. The next material advancement requires human/manual external evidence.

## Exact manual/external evidence now required

### A. Exact Romania Gap package — issue #215

For the active target canonical family:

1. Freeze and manually approve the alias/query set before enumeration.
2. Collect direct eMAG and Trendyol snapshots through the canonical Romania ledger path under the same canonical comparability key.
3. Enumerate all result pages required by the exact-evidence protocol; preserve query, page/result position, listing URL/ID, seller when observable, timestamp and raw/source reference.
4. Deduplicate identical listings across aliases/pages.
5. Manually classify every listing against the exact canonical specification; ambiguous rows remain unresolved, never assumed non-match.
6. Manually confirm MARKET_WIDE scope for both platforms.
7. Record exact comparable listing counts separately from surface/lower-bound counts.
8. Run the promotion report; only PROMOTABLE evidence may satisfy the KPI.

### B. Verified supplier package — issue #216

For the exact same canonical product specification, obtain at least three direct comparable supplier quotes containing:

- supplier legal/marketplace identity and quote timestamp/source;
- exact product configuration and specification confirmation;
- MOQ and unit/set price at target quantity with currency;
- sample terms;
- production/lead time;
- EXW/FOB and Romania shipping/DDP terms where actually quoted;
- carton quantity, carton dimensions, gross/net weight where relevant to freight;
- compliance/certification status and basis;
- any variant dependencies that change price, pack or freight.

At least one complete quote must pass the shared strict manual verifier. A public Alibaba/1688 listing or company-level DDP capability is not a verified Romania quote.

### C. Confirmed landed economics — issue #217

After B exists, resolve with provenance:

- FX source/rate if conversion is required;
- freight or explicit DDP evidence;
- EU/Romania customs classification and duty treatment;
- import VAT treatment;
- brokerage/handling/domestic transport;
- packaging/compliance reserves;
- marketplace commission/fulfillment;
- advertising, returns, warranty and other configured reserves;
- sell-price scenario tied to observable Romania market evidence.

Then calculate confirmed landed cost/unit, profit/unit, margin, ROI and break-even. Any unresolved required cost remains unknown and blocks confirmation.

## Importability evidence boundary

If the active candidate is routed into an importability review class, the newly merged readiness view can identify missing dimensions/weight/material/brand-variant evidence. Filling those fields is useful zero-cost evidence work when a trustworthy source already exists, but human importability approval remains required. Readiness alone cannot advance Romania/economics/finalist gates.

## Stop condition

The First Finalist program is currently external-evidence blocked. Do not trigger paid providers, send RFQs, negotiate, order or purchase without explicit user approval. Do not convert sampled Romania into exact evidence, supplier listings into verified quotes, or verified quotes into confirmed landed cost.
