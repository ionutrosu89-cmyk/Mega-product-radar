# Public Free launch evidence — 2026-09-07

This file supplements `PUBLIC_FREE_LAUNCH_AUDIT.md`. It records direct evidence produced during the P0 hardening pass. It does **not** change the overall release verdict: **NO-GO** until all remaining P0 blockers are verified.

## Cross-tenant isolation — VERIFIED LIVE SQL POLICY EVALUATION

A simulated `authenticated` JWT with a UUID that has no workspace membership was evaluated under PostgreSQL role `authenticated` against an existing workspace. The transaction was rolled back after the test.

READ matrix returned zero visible rows for all tested tenant surfaces:
- `workspaces`
- `products`
- `commercial_watchlist`
- `portfolio_items`
- `landed_costs`
- `supplier_offers`

WRITE matrix used no-op `UPDATE` statements against the same workspace and returned zero updated rows for all six surfaces.

Result: RLS/privilege evaluation prevented both read and write for a non-member authenticated identity. A physical two-browser/two-account E2E remains a release acceptance test; this evidence must not be described as that browser test.

## Browser privilege hardening — VERIFIED LIVE

`TRUNCATE`, `TRIGGER` and `REFERENCES` were revoked from `anon` and `authenticated` across public tables. Live post-migration verification returned zero remaining grants. The migration chain contains the same control to prevent environment drift.

## Privacy retention — VERIFIED LIVE

Production has active pg_cron job `mpr_privacy_retention_daily`, scheduled at `17 3 * * *`, calling `private.enforce_privacy_retention_v1()`.

Verified retention contract:
- `free_demand_events`: delete after 90 days
- `usage_events`: delete after 12 months
- `feedback_events`: delete after 12 months
- `journey_events`: delete after 12 months
- `beta_feedback`: delete after 12 months

The function is `SECURITY DEFINER`, uses constrained `search_path=pg_catalog, public, private`, and has execute ACL only for `postgres`. The 2026-09-07 03:17 UTC cron execution succeeded.

## Public Free cost / provider boundary — FIXED, CI verification required on latest head

Public Free endpoint inventory under contract test:
- `free-top25.mjs`
- `free-cross-market.mjs`
- `free-niche-top25.mjs`
- `free-demand-event.mjs`

The repository test requires server-side rate limiting and rejects paid-provider credential markers/import paths. `free-cross-market.mjs` was decoupled from `_ebay-buy-auth.mjs`; eBay Free exposure is now snapshot-approval state only.

## Public health endpoint — FIXED, CI + deployed proof required

Legacy `/api/radar/health` disclosed secret configuration booleans and performed Netlify Blob write/read/delete operations on every public request. It was replaced by side-effect-free liveness only. A regression test rejects secret markers and storage operations in the public health source.

## 25 x 25 category safety gate — FIXED, CI verification required

The licensed historical Free universe resolves to 25 niches x 25 positions = 625. A new public category risk policy:
- blocks explicit firearms/ammunition/explosives/restricted weapons/nicotine/drugs/alcohol/adult/high-risk-supplement terms from commercial eligibility;
- routes bladed tools/self-defense/weight-loss risk terms to manual review;
- uses token boundaries to avoid substring false positives such as `twine` -> `wine`.

A current historical product named as a window tint kit containing a utility knife/blades is therefore displayed only as historical evidence and becomes `STOP_CATEGORY_REVIEW`, not a commercial import recommendation.

## Monitoring / alerting — FIXED IN CODE, NOT YET LIVE

`.github/workflows/public-free-uptime-monitor.yml` checks production twice per hour after merge to `main`:
- `/beta.html`
- `/api/radar/health`
- `/api/free/top25`

Failure opens or updates a single GitHub incident issue; recovery comments and closes it. This does not call paid market-data providers. Monitoring must remain marked **not LIVE** until the workflow is merged to `main` and a successful production execution is observed.

## Remaining operator/platform blockers

- Supabase leaked-password protection: unresolved platform/operator action.
- CAPTCHA/Turnstile/Auth abuse settings: unresolved platform/operator action.
- `supabase_admin` future-function default EXECUTE ACL: unresolved because current available role cannot alter it.
- final legal review of Terms/Privacy/Cookie/subprocessors/transfers: unresolved.
- physical two-account browser E2E: unresolved.
- latest PR head full CI and Netlify preview: must pass before merge.
