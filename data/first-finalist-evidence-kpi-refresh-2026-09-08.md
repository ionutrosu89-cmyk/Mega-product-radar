# First Finalist evidence KPI refresh — 2026-09-08

## Scope

Truth-preserving checkpoint for the First Finalist Program after the supplier-page screening policy update and the latest repository work.

This checkpoint does **not** promote any candidate and does not authorize paid data, supplier outreach, negotiation, sample, order, or purchase.

## Canonical truth boundaries

- UNKNOWN is not zero.
- Review count and Best Sellers Rank are not verified sales.
- Sampled / multi-surface Romania evidence is not exact MARKET_WIDE evidence.
- A supplier listing or supplier product page is not a verified commercial quote.
- A verified commercial quote is not confirmed landed cost.
- Page-backed economics are screening estimates unless every strict confirmation gate is satisfied.
- Human-review readiness is not human approval.
- FINALIST is not TEST_READY and never authorizes purchase.

## Eight First Finalist evidence KPIs

| KPI | Current value | Evidence interpretation |
|---|---:|---|
| productsWithConfirmedTrendFusion | >=1 | B08BJHMY33 has persisted CONFIRMED_ACCELERATION evidence; rank/reviews remain NOT_VERIFIED_SALES. |
| nichesWithExactRomaniaGap | 0 | Issue #215 remains open; no niche has complete manually confirmed eMAG + Trendyol MARKET_WIDE exact-comparable evidence. |
| productsWithVerifiedSupplierPackage | 0 | Supplier-page observations can support screening, but they are not a verified quote/package for the strict Supplier Gate. |
| productsWithConfirmedLandedEconomics | 0 | Page-backed landed estimates do not equal confirmed landed cost. |
| PROMISING | >=1 | At least one candidate has legitimate trend support, while downstream hard gates remain incomplete. |
| VALIDATE | 0 | Exact Romania Gap is still missing for the leading candidate. |
| FINALIST | 0 | Strict Opportunity V4 requirements are not all satisfied. |
| TEST_READY | 0 | No legitimate FINALIST has passed compliance/test gates. |

## Relevant current repository state

### Trend
Issue #214 remains the longitudinal rank/review evidence program. The persisted B08BJHMY33 trend case supports confirmed acceleration only under the strict fusion contract. This evidence remains explicitly non-sales evidence.

### Romania Gap — current controlling blocker
Issue #215 requires the first direct, exact, manually reviewed, comparable eMAG + Trendyol niche with:
- one canonical comparability key;
- direct marketplace source URLs;
- exhaustive/complete enumeration for the approved alias set;
- listing-level deduplication;
- listing-level classification as EXACT_COMPARABLE, NON_COMPARABLE, or UNKNOWN;
- exact counts kept separate from raw/sampled/lower-bound counts;
- explicit human confirmation of MARKET_WIDE scope;
- canonical Romania snapshot-ledger ingestion;
- promotion report = PROMOTABLE.

Until all of those are true, `nichesWithExactRomaniaGap` remains 0.

### Supplier / economics policy update
Issue #217 now permits decision-grade **screening** from exact supplier product-page observations:
- observed supplier identity and direct product-page URL;
- displayed price/range, currency and MOQ/tier;
- dimensions/weight/carton facts where actually shown;
- carrier-estimated freight using chargeable weight when freight is not quoted;
- explicit FX, VAT, customs/brokerage treatment and Romania sell-price scenario;
- missing values preserved as UNKNOWN or clearly labelled estimates.

This removes the need to wait for supplier contact merely to continue screening.

It does **not** change the strict First Finalist semantics:
- supplier page != verified quote;
- page-backed screening != verified supplier package;
- estimated landed economics != confirmed landed economics;
- sample/order/negotiation/purchase requires explicit user approval.

### FINALIST
Issue #218 remains fail-closed. Opportunity V4 FINALIST requires the same candidate to have:
1. confirmed longitudinal trend fusion;
2. exact comparable Romania Gap;
3. verified supplier package;
4. confirmed landed economics;
5. sufficient confidence/provenance.

No score or compatibility shortcut can replace a failed hard gate.

## Next eligible zero-cost action

The remaining zero-cost repository step in this checkpoint is evidence synchronization only. The next **material** advancement requires human/manual external Romania evidence for the leading candidate niche.

For B08BJHMY33 / oversized 4-pack cotton beach towels, capture both eMAG and Trendyol using the approved canonical alias set and preserve:

- every traversed result page / search URL;
- listing URL and stable listing/product ID where available;
- seller identity for deduplication;
- title, pack count, dimensions, material/construction and other decisive comparability attributes;
- classification: EXACT_COMPARABLE / NON_COMPARABLE / UNKNOWN;
- reason for every exclusion or UNKNOWN;
- observation timestamp;
- attachment/screenshot reference for reviewed evidence;
- reviewer identity;
- explicit statement whether the alias set + pagination is complete enough to assert MARKET_WIDE.

A blocked page, inaccessible result, missing pagination, ambiguous pack/size/material, or unreviewed listing remains UNKNOWN. It must never be converted to zero or a non-match.

## Spend / authority

- paid provider calls triggered by this checkpoint: 0
- provider spend authorized by this checkpoint: EUR 0
- supplier outreach authorized: false
- negotiation authorized: false
- sample/order/purchase authorized: false
- verified-sales claim created: false
- FINALIST promoted: false
