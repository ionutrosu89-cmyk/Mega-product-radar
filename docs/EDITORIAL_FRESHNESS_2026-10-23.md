# Editorial freshness contract — 23 October 2026

User outcome: the Free research page must not present evidence older than 30 days as current, including when the browser remains open between visits.

## Rules and scope

- Identity, generic-concept review, publication review, supplier and product-specific interest evidence expire after at most 30 days. Existing stricter seven-day limits for Romanian offers, costs and advertising signals remain.
- Google Trends CSV import rejects a last interval older than 30 days. Public signal validation measures the interval end against the current time as well as the observation date; re-observing an old export cannot renew it.
- The editorial browser revalidates the original feeds on each render, return to the tab, page restore and once per minute while visible. Counts, cards, details and signals are recomputed. Saving revalidates before accepting the product.
- No fetch, paid collection, approval or publication is triggered by the clock check. A new observation still needs independent source verification and review.

## Acceptance evidence

Tests advance a controlled clock across expiry, verify the card and signal disappear without page reload, reject a stale save action and retain the source research links. Boundary tests cover 30 days and older observations/intervals. These are controlled software tests, not supplier, rights or beta-user evidence.

The page may remain rendered up to one minute past expiry while continuously visible. Every user-triggered render and save checks immediately; hidden tabs check on return. Public launch remains blocked by the existing release gates.
