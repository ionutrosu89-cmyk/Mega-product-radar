# MPR Current Top25 Freshness Policy

Effective: 2026-09-07

## Primary rule

The commercial MPR Top25 must be current. Historical 2023 catalog data may remain available only as an explicitly labeled archive/reference source and must not populate the primary commercial Top25.

## Required ranking windows

Every public/current niche must expose two independently computed windows:

- `TOP_7D`: evidence observed during the trailing 7 days.
- `TOP_30D`: evidence observed during the trailing 30 days.

Optional supporting signal:
- `TREND_24H`: very recent acceleration/discovery signal. It is not automatically a sales rank.

A current Top25 position must include:
- observation timestamp;
- ranking window (`7D` or `30D`);
- market/platform;
- source URL or official API source identifier;
- evidence class (`DIRECT`, `DERIVED`, `ESTIMATED`, `INSUFFICIENT_DATA`);
- source metric type;
- commercial brand gate;
- category-risk gate.

## Freshness gate

A position is ineligible for `TOP_7D` if its newest qualifying observation is older than 7 days.
A position is ineligible for `TOP_30D` if its newest qualifying observation is older than 30 days.

No stale historical fallback is allowed. If a niche has fewer than 25 qualifying current positions, MPR publishes the actual coverage and `INSUFFICIENT_DATA`; it must not fill the missing positions with 2023 products.

## Evidence hierarchy

Preferred current sources, subject to rights/access approval:

1. Official marketplace ranking/API evidence such as eBay Buy Marketing `BEST_SELLING` by category.
2. Official/live marketplace product observations with timestamped ranking or position evidence.
3. Current search/trend evidence such as Google Trends, clearly labeled as search interest rather than sales.
4. Current social/viral evidence (TikTok/other platforms) only where terms/access permit and always labeled by the metric actually observed.
5. Current Romania competition/listing evidence for market-gap analysis.

Public product pages can support current price/rating/review/listing evidence, but price/review counts alone must not be represented as verified sales rank.

## Multi-source scoring

The future Current Opportunity Score should combine, without fabricating unavailable metrics:

- marketplace rank / best-selling position when DIRECT;
- 7-day rank persistence;
- 7-day vs 30-day acceleration;
- review-count delta when multiple observations exist;
- search acceleration;
- social/viral acceleration;
- Romania competition/gap;
- supplier public standard price and chargeable shipping economics;
- brand/category/compliance gates.

Unknown metrics remain unknown and contribute no fabricated value.

## Historical archive

`KAGGLE_AMAZON_PRODUCTS_2023` remains allowed only under `ARCHIVE_2023` / `HISTORICAL_REFERENCE` experience. It must not be used to claim:
- current best sellers;
- current market demand;
- current sales;
- `TOP_7D`;
- `TOP_30D`.

## Launch target

Target architecture remains 25 niches x Top25 current products = 625 current positions for each ranking window where evidence coverage permits.

Release quality takes priority over filling the number. 625 stale or synthetic positions are worse than fewer positions with current, verifiable evidence.
