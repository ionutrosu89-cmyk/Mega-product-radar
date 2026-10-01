# First Finalist evidence KPI refresh — 2026-09-09

Evidence-only checkpoint for the First Finalist Program after the latest merged Intervention Watch and eBay taxonomy-safety work on `main`.

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

## Eight evidence KPIs

| KPI | Evidence-backed state | Gate to advance |
| --- | --- | --- |
| Products with confirmed trend fusion | >=1 | Preserve independent longitudinal rank/review evidence and provenance; never reinterpret the signal as verified sales. |
| Products with exact Romania Gap | 0 | Complete direct, exact, manually reviewed, comparable MARKET_WIDE eMAG + Trendyol evidence under the same canonical comparability key. |
| Products with verified supplier package | 0 | Obtain >=3 complete comparable direct quotes for the same canonical specification; at least one must be MANUALLY_VERIFIED. |
| Products with confirmed landed economics | 0 | Requires complete verified quote plus explicit FX, freight/DDP, duty/customs/tax/compliance, sell-price and reserve inputs with provenance. |
| PROMISING | >=1 | Trend/proxy evidence may support PROMISING only; it cannot bypass Romania, supplier or economics gates. |
| VALIDATE | 0 | Exact Romania evidence is a prerequisite; sampled Romania and public supplier listings cannot promote to VALIDATE. |
| FINALIST | 0 | Requires all Opportunity V4 finalist gates to pass legitimately and shortlist cap <=3. |
| TEST_READY | 0 | Requires a legitimate downstream commercial approval after FINALIST; no purchase authority is implied. |

## Latest repository evidence

- Latest `main` commits add Intervention Watch detail, operator workflow, filters and sync status, plus path-aware eBay taxonomy validation.
- These are useful product/reliability capabilities but do not create new demand, exact Romania, supplier or landed-cost evidence.
- Existing G2 evidence remains: 10K canonical Amazon identities and observation-depth milestones are achieved, while live/current Romania coverage and category/comparability completeness remain incomplete.
- The commercial gate remains fail-closed: `READY_FOR_HUMAN_IMPORTABILITY_REVIEW` is readiness only, not human PASS; no score overrides a failed hard gate.

## Open First Finalist issues

- #214 trend fusion: open; preserve independent longitudinal rank/review evidence and never treat rank/reviews as verified sales.
- #215 exact Romania Gap: open; requires canonical eMAG + Trendyol snapshots, same comparability key, direct source URLs, manual MARKET_WIDE confirmation, exact listing counts and PROMOTABLE evidence.
- #216 supplier package: open; requires >=3 complete comparable quotes for the same specification and >=1 MANUALLY_VERIFIED quote. Public listings/partials are insufficient.
- #217 landed economics: open; requires verified quote plus explicit cost/provenance inputs. Estimates remain estimates and missing required inputs remain UNKNOWN.
- #218 first legitimate Opportunity V4 FINALIST: open; remains blocked until the preceding gates are satisfied.
- #551 commercial validation: open; importability decisions, Romania current comparable coverage, Golden Set audit, economics and supplier gates remain incomplete.

## Next eligible zero-cost step executed

This checkpoint synchronizes the First Finalist evidence ledger with the latest merged repository state. It is repository-only, append-only evidence documentation with zero provider spend and zero external side effects.

No KPI is promoted by this checkpoint. No automatic FINALIST transition is available from the current evidence.

## Exact human/manual external evidence still required

### A. Exact Romania Gap — issue #215

For the active candidate canonical family (currently the trend-led candidate remains `B08BJHMY33` unless a newer evidence-backed candidate is formally selected):

1. Freeze and manually approve the alias/query set before enumeration.
2. Collect direct eMAG and Trendyol snapshots through the canonical Romania ledger under the same comparability key.
3. Preserve query, page/result position, listing URL/ID, seller when observable, timestamp and raw/source reference.
4. Deduplicate identical listings across aliases/pages and at seller level where applicable.
5. Manually classify every listing as `EXACT_COMPARABLE`, `NON_COMPARABLE` or `UNKNOWN`; ambiguous rows stay unresolved.
6. Manually confirm `MARKET_WIDE` scope for both platforms.
7. Record exact comparable counts separately from surface/lower-bound counts.
8. Run the promotion report; only `PROMOTABLE` evidence may advance the KPI.

### B. Verified supplier package — issue #216

Only after Brand + Trend + Romania Gap + Importability PASS, obtain >=3 direct comparable supplier quotes for the exact same specification, including supplier identity, timestamp/source, exact configuration, MOQ, unit/set price and currency, sample terms, lead time, EXW/FOB and Romania shipping/DDP terms where actually quoted, carton data, compliance basis and variant dependencies. At least one complete quote must pass the strict manual verifier.

### C. Confirmed landed economics — issue #217

After B exists, resolve with provenance: FX, freight or explicit DDP, customs classification/duty, import VAT, brokerage/handling/domestic transport, packaging/compliance, marketplace fees/fulfillment, ads, returns/warranty reserves and observable Romania sell-price evidence. Any unresolved required cost remains UNKNOWN and blocks confirmation.

## Stop condition

The First Finalist program is currently external-evidence blocked. Do not trigger paid providers, send RFQs, negotiate, order or purchase without explicit user approval. Do not convert sampled Romania into exact evidence, supplier listings into verified quotes, or verified quotes into confirmed landed cost.
