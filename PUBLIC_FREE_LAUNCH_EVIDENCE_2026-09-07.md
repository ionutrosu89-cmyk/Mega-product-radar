# Public Free launch evidence — 2026-09-07

This file supplements `PUBLIC_FREE_LAUNCH_AUDIT.md`. It records direct evidence produced during the P0 hardening pass. It does **not** change the overall release verdict: **NO-GO** until all remaining P0 blockers are verified.

## Cross-tenant isolation — VERIFIED LIVE SQL POLICY EVALUATION

A simulated `authenticated` JWT with a UUID that has no workspace membership was evaluated under PostgreSQL role `authenticated` against an existing workspace. The transaction was rolled back after the test.

READ matrix returned zero visible rows for all tested tenant surfaces:
- `workspaces`
- `workspace_members`
- `products`
- `commercial_watchlist`
- `portfolio_items`
- `landed_costs`
- `supplier_offers`

WRITE matrix used no-op `UPDATE` statements against the same workspace and returned zero updated rows for all six writable surfaces tested.

Result: RLS/privilege evaluation prevented both read and write for a non-member authenticated identity against real workspace data. A physical two-browser/two-account E2E remains a release acceptance test; this evidence must not be described as that browser test.

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

## Public Free cost / provider boundary — HARDENED, LATEST CI PENDING

Public Free endpoint inventory under contract test:
- `free-top25.mjs`
- `free-cross-market.mjs`
- `free-niche-top25.mjs`
- `free-demand-event.mjs`

The repository test requires server-side rate limiting and rejects paid-provider credential markers/import paths. `free-cross-market.mjs` was decoupled from `_ebay-buy-auth.mjs`; eBay Free exposure is snapshot-approval state only.

The shared rate limiter is now fail-closed in production. If the atomic Supabase rate-limit RPC is unavailable, rejects the request, or is not configured, production returns a denied `RATE_LIMIT_BACKEND_UNAVAILABLE` decision instead of falling back to per-instance serverless memory. Local fallback remains available only outside production. Regression tests cover shared-store exception, shared-store HTTP failure and development fallback.

## Public health endpoint — FIXED, DEPLOYED PROOF REQUIRED

Legacy `/api/radar/health` disclosed secret configuration booleans and performed Netlify Blob write/read/delete operations on every public request. It was replaced by side-effect-free liveness only. A regression test rejects secret markers and storage operations in the public health source.

## 25 x 25 structural evidence — VERIFIED LIVE

The licensed historical Free universe resolves to exactly 25 niches x 25 positions = 625. The eligible snapshot set has:
- 25/25 niches;
- 625/625 positions;
- zero duplicate ASINs inside a niche;
- zero missing source URL, source period, evidence class or commercial gate;
- historical rank class `DERIVED`, not a current Amazon sales rank.

Seven ASINs overlap across different niches; these are cross-category overlaps rather than within-niche duplicate positions. Two semantic placements remain review items before final GO.

## Brand commercial gate — VERIFIED AGAINST CURRENT 625, POLICY EXPANDED

Current 625 audit found 93 positions (14.9%) matching the reviewed established-brand denylist across 21 niches; 532 positions are non-established or still `UNKNOWN_REVIEW`. Established-brand positions remain visible only as historical archive evidence and are `commercialEligible=false / STOP_BRAND_GATE`; they are not commercial recommendations.

The audit identified missing reviewed phrases for `Fiskars` and the licensed `Nerf Dog` product line. Both were added to the policy with regression tests. A generic organizer that merely mentions `nerf gun storage` is deliberately not blocked by a broad `nerf` substring rule.

## 25 x 25 category safety gate — VERIFIED AGAINST CURRENT 625, LATEST CI PENDING

The public category risk policy:
- blocks explicit firearms/ammunition/explosives/restricted weapons/nicotine/drugs/alcohol/adult/high-risk-supplement terms from commercial eligibility;
- routes bladed tools/self-defense/weight-loss risk terms to manual review;
- uses token boundaries to avoid substring false positives such as `twine` -> `wine`.

Against the current 625 eligible historical positions the classifier audit found:
- `BLOCK`: 0
- `MANUAL_REVIEW`: 2
- all remaining positions: `ALLOW` at the category-risk layer

The two manual-review positions are a window-tint tool kit containing a utility knife/blades and a pruning-shear product with an explicit blade. The pruning-shear product is also held by the expanded Fiskars brand gate.

## Auth CAPTCHA integration — FRONTEND GAP CONFIRMED

Supabase's current CAPTCHA contract requires the frontend to obtain a CAPTCHA token and pass it in Auth options; the existing MPR `signUp` implementation does not currently pass `captchaToken`. Therefore dashboard-side Attack Protection alone is not treated as proof that signup abuse protection is operational end to end.

The dashboard setting has previously been configured by the operator, but the provider/site key is not recoverable from repository evidence. The remaining engineering task is to connect the configured provider's public site key to the login/signup UI and pass the challenge token to Supabase Auth. No CAPTCHA secret belongs in client code.

## Monitoring / alerting — FIXED IN CODE, NOT YET LIVE

`.github/workflows/public-free-uptime-monitor.yml` checks production twice per hour after merge to `main`:
- `/beta.html`
- `/api/radar/health`
- `/api/free/top25`

Failure opens or updates a single GitHub incident issue; recovery comments and closes it. This does not call paid market-data providers. Monitoring must remain marked **not LIVE** until the workflow is merged to `main` and a successful production execution is observed.

## Remaining operator/platform blockers

- Supabase leaked-password protection: independent dashboard/API proof still unresolved.
- Auth CAPTCHA: dashboard configuration has already been performed; frontend token integration + public provider/site-key wiring remains unresolved.
- `supabase_admin` future-function default EXECUTE ACL: unresolved because current available role cannot alter it; current application-owned functions are separately restricted.
- final legal review of Terms/Privacy/Cookie/subprocessors/transfers: unresolved.
- physical two-account browser E2E: unresolved; live SQL A→B policy evaluation is verified separately above.
- latest PR head full CI and Netlify preview: must pass before merge.
