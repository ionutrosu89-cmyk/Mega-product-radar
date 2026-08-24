# Real Product Bootstrap 1000

Status: **1,000 real Amazon product identities reached**.

## Evidence contract

- Source: public `luminati-io/Amazon-dataset-samples` repository.
- Source commit: `8259a2c9dc6e513219c3ca0aa02503e103c27ed6`.
- Native identity: Amazon ASIN.
- Persisted products: 1,000 unique ASINs / 1,000 unique canonical URLs.
- Coverage: 1,000 titles, 1,000 ratings, 1,000 review counts, 1,000 categories, 997 prices.
- Freshness: `BOOTSTRAP_SNAPSHOT_NOT_LIVE`.
- Ranking semantics: none; bootstrap catalogue data is not a live ranking observation.
- Sales semantics: `NOT_VERIFIED_SALES`.
- Provider spend: EUR 0.
- Paid calls: 0.
- Purchase authorization: false.

## Integrity

The public source dataset contains 212 rows where its supplied product URL resolves to a different ASIN/variant than the ASIN field. MPR does not hide this. The original mismatch is retained in integrity metadata, while MPR product identity and canonical URL are derived from the native ASIN. Canonical URL mismatch count is therefore 0.

## Milestones

- 1K: reached
- 5K: next
- 10K: planned

The bootstrap establishes catalogue breadth. Fresh public snapshots are still required before trend, velocity, ranking, or current-market claims are made.
