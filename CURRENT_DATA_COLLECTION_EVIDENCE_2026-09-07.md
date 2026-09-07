# Current data collection evidence — 2026-09-07

Status: LIVE INTERNAL COLLECTION / PUBLIC FREE STILL NO-GO

## Google Trends Romania

- Edge Function: `google-trends-ro-collector-v1`, production version 1.
- Trigger: private SECURITY DEFINER function `private.invoke_google_trends_ro_collector_v1()`.
- Scheduler: `mpr_google_trends_ro_hourly`, active, `7 * * * *`.
- Cron token is stored in Supabase Vault as `mpr_google_trends_ro_cron_token`; raw token is not committed to Git.
- Invoker ACL verified live: `{postgres=X/postgres}` only.
- Invoker search path verified: `pg_catalog, public, private`.
- First manual production invocation: HTTP 200.
- First invocation read 10 current Romania RSS trends and found 0 product-relevant terms at that moment.
- Zero accepted signals is a valid truth-preserving result, not a collector failure.
- Evidence policy: `SEARCH_INTEREST_NOT_SALES`, `verifiedSales=false`, `providerSpendEur=0`, no historical fallback.

## Amazon current repeated observation

- Edge Function: `amazon-current-refresh-collector-v1`, production version 3.
- Target RPC: `amazon_current_refresh_targets_v1`.
- Trigger: private SECURITY DEFINER function `private.invoke_amazon_current_refresh_collector_v1()`.
- Scheduler: `mpr_amazon_current_refresh_2h`, active, `23 */2 * * *`.
- Cron token is stored in Supabase Vault as `mpr_amazon_current_refresh_cron_token`; raw token is not committed to Git.
- Invoker ACL verified live: `{postgres=X/postgres}` only.
- Invoker search path verified: `pg_catalog, public, private`.
- Production test at batch size 10: requested 10, valid 10, success 100%, blocked 0, HTTP failures 0, matched exact ASIN 10, observation rows inserted 30.
- A scale test at batch size 25 fetched successfully but persistence hit PostgreSQL statement timeout; the system was deliberately reduced to 10 per batch rather than weakening database timeout controls.
- Final operating cadence: 10 targets every 2 hours, approximately 120 target refreshes/day before retries/duplicates.
- Evidence policy: `LIVE_PUBLIC_PRODUCT_PAGE`, `NOT_VERIFIED_SALES`, `purchaseAuthorized=false`, `providerSpendEur=0`, `paidCallsTriggered=0`.
- Amazon public-page observations remain internal/secondary evidence and are not promoted as verified sales or official bestseller rank.

## eBay

- eBay remains the preferred direct current ranking source because the collector uses official Buy Marketing `BEST_SELLING` rank.
- Production readiness depends on `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `MPR_EBAY_TERMS_APPROVED`, and `MPR_EBAY_PRODUCTION_ACCESS_APPROVED`.
- No eBay readiness state is persisted in Supabase, so current production credential/approval readiness cannot be proven from the available DB tooling.
- No eBay current snapshot has been fabricated while access remains unverified.

## Release consequence

Current-data accumulation is now running independently of the Draft PR. This does not change the Public Free launch verdict: NO-GO remains until the P0 launch gates are verified. Historical 2023 data remains archive-only and must not backfill missing current 7D/30D positions.
