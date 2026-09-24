# Free launch evidence — 24 September 2026

This is a dated evidence record, not an automatic launch approval. Keep paid checkout disabled until the separate human launch review passes.

## Scope and current state

- Public Top25 scope: `free-top25-live-taxonomy-v1.js` defines exactly 25 niches and 625 target positions. `/api/free/top25` publishes the taxonomy only; `/api/free/cross-market` publishes complete current snapshots when they exist. The separate `/api/free/niches` endpoint uses the 108-niche Category Universe research taxonomy and must not be counted toward the 25 public Top25 promises.
- Supabase `current_top25_snapshots_v1`: 0 rows on 24 September. The public preview showed 0 live positions. Historical `top25_snapshots` has 16 rows for 8 niches, last reviewed 4 September, and is not a live fallback.
- Local Amazon.com review queue: `artifacts/amazon-niche-slices-latest-review-queue.csv` has 625 provisional candidate rows. It is ignored by Git and is **research material only**. It does not grant display rights, prove a generic/private-label identity, or constitute 625 approved products.
- Pilot niche: `BIROU_ORGANIZARE`. The first 30 source positions yielded 26 pending brand-and-niche reviews, 2 established-brand exclusions, and 2 wrong-niche exclusions. There are 0 approved products. Use `artifacts/amazon-pilot-triage-latest.csv` for manual review; keep it internal.
- Live beta evidence: 0 participants, 0 feedback rows, and 0 completed product tests in Supabase. Two auth users and three workspaces exist, but cross-workspace browser behavior and a physical-phone test have not been attested.
- Payment evidence: one six-checkpoint sandbox GO is tied to an older deployment (5 September). It does not approve the current commit or live money. The production evidence record has no verified restore or stable queues.

## Release gates

1. **Source and rights:** record the provider, contract/terms version, permitted public fields, attribution, cache TTL, reviewer and proof reference. Current Amazon public-page observations are for internal analysis only. A provider or licensed source must explicitly permit the intended public Top25 display. Never set `MPR_*_PUBLIC_DISPLAY_APPROVED` from an assumption.
2. **Pilot Top25:** review each `BIROU_ORGANIZARE` candidate for niche fit, distinct product identity, established-brand exclusion, source URL and observation within the platform's 72-hour window. Keep original source rank distinct from any curated generic-only order. Do not label a filtered rank as the marketplace's exact rank. Publish only after 25 eligible positions and rights proof pass the ingest gate. If fewer than 25 pass, show coverage/empty state.
3. **Free journey:** with two separate accounts and workspaces, verify login, onboarding, product/source detail, shortlist/watchlist, refresh persistence, intervention detail and action, and denial of cross-workspace reads/writes. Test the same path on a physical phone. Record device, browser, commit, workspace A/B, result and defects; never store passwords or session tokens in the record.
4. **External beta:** run at least five real sessions through `beta-study.html`. The study records comprehension, usefulness and watchlist completion. Calculate the agreed thresholds from saved sessions (at least 80%, 60%, 80% respectively), investigate every critical failure, and obtain one fully documented product flow. Do not count invitations or scripted test accounts as sessions.
5. **Operations and payments:** verify public domain and team protection, account recovery, support/incident response, data restore and queue health. Review the two intentionally authenticated Intervention Watch RPCs for membership checks and perform the two-account test. Re-run six-checkpoint billing E2E against the exact deployment proposed for paid launch. Complete all eight `launch-readiness.mjs` checks with current evidence; final public/paid launch remains a human decision.

## Evidence that must be obtained outside the repository

- A source agreement or official access allowing public display of recent ranked products. eBay and AliExpress access was not available at this review; do not bypass provider restrictions.
- Five moderated participant sessions and a physical-device test, performed by a real tester.
- Written supplier quote with fixed specification, MOQ, packaging, shipping and Romanian import/local costs for each pilot product taken into commercial validation. A similar listing is not a quote.

## Decision

**NO-GO for a public Free promise of 25 products in each of 25 niches; NO-GO for paid launch.** A clearly labelled registration/feedback beta may be opened after its public access and core account flow are tested. Recalculate this decision from fresh evidence before changing launch status.
