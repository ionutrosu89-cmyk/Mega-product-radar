# Mega Product Radar — Public Free Launch Audit

Baseline date: 2026-09-07
Owner: RED COMMERCE S.R.L.
Target: PUBLIC FREE BETA
Release rule: NO-GO until every P0 is FIXED and VERIFIED with evidence.

## Audit doctrine

Every control has three stages: FAIL -> FIXED -> VERIFIED. A code change alone is not a PASS. Unknown remains unknown. No source is exposed commercially without documented rights. No estimate is presented as verified fact. No Free-plan limit may rely only on client-side UI.

## Current verified facts

- Production target is Netlify.
- CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame protection and no-store API headers exist in `netlify.toml`.
- Public beta legal pages exist: `privacy.html`, `terms.html`, `sources.html`.
- `public` tables inspected have RLS enabled.
- Current `SECURITY DEFINER` functions inspected are restricted to `postgres` / `service_role` and use `search_path=pg_catalog, public`.
- All inspected public views use `security_invoker=true` and are restricted to `postgres` / `service_role`.
- Default EXECUTE grants for future functions created by `postgres` have been revoked from PUBLIC/anon/authenticated by migration `20260907_lock_down_future_public_function_execute.sql`.
- `TRUNCATE`, `TRIGGER` and `REFERENCES` privileges have been revoked from `anon` and `authenticated` across public tables; live verification returned zero remaining grants.
- Supabase `supabase_admin` default function privileges could not be changed by the available role; this remains an operator/admin action.
- A simulated authenticated JWT with no workspace membership returned zero rows across the tested browser-readable tenant tables.
- Free catalog has 25 distinct niches x exactly 25 positions = 625 positions. Public endpoint selection is now fail-closed and chooses the newest eligible 25/25 historical snapshot rather than merely the newest snapshot.
- Free public presentation is historical Amazon 2023, not a claim of 2026 best sellers.
- PR CI run 1811 passed dependency audit, migration chain, production safety gates, 1733/1733 tests and build.

## P0 — SECURITY

| Control | Status | Evidence / next proof |
|---|---|---|
| Leaked-password protection | FAIL | Supabase advisor says disabled. Enable in Auth settings if plan supports it; otherwise use passwordless-only or equivalent compensating control before GO. |
| RLS enabled on exposed tables | VERIFIED | Live DB inspection shows RLS enabled; simulated authenticated non-member read matrix returned zero rows on tested tenant tables. |
| User A cannot read/write User B | PARTIAL VERIFIED | Authenticated non-member read matrix returned zero. Full real two-user read/write E2E remains required before GO. |
| Browser DDL-like privileges | VERIFIED | Live migration removed TRUNCATE/TRIGGER/REFERENCES from anon/authenticated; verification returned 0/0/0 remaining grants. |
| SECURITY DEFINER public exposure | VERIFIED | Current privileged functions ACL restricted to postgres/service_role; no anon/authenticated/PUBLIC execute found. |
| SECURITY DEFINER search_path | VERIFIED | Current privileged functions use `pg_catalog, public`. |
| Future postgres-created function grants | VERIFIED | Migration applied live and committed to migration chain; default ACL verified. |
| Future supabase_admin-created function grants | FAIL | Permission denied changing supabase_admin default ACL. Requires platform/admin action. |
| Public views respect RLS / no privilege bypass | VERIFIED | All inspected views have `security_invoker=true` and service-only ACL. |
| service_role/secret absent from browser | FIXED | Build now runs `scan-public-bundle-secrets.mjs` against `_site`; requires fresh CI PASS on current head to become VERIFIED. |
| Rate limits for expensive endpoints | PARTIAL | `free-top25` and several public endpoints already use server-side `enforceRateLimit`; complete endpoint inventory still required. |
| Free quota atomic server-side | FAIL | Must prove direct API calls cannot bypass usage limits for every cost-bearing operation. |
| Signup/bot abuse protection | FAIL | Verify CAPTCHA/Turnstile and Auth rate limits. |
| High/Critical dependency vulnerabilities | VERIFIED | PR CI run 1811 executed `npm audit --audit-level=high --omit=dev`; 0 vulnerabilities. |
| Backup / restore contract | VERIFIED CI | Production Persistence Restore CI run 974 passed restore evidence and fail-closed drill. A real disaster-recovery rehearsal against production backup remains an operational P1/P0 readiness proof before broad launch. |

## P0 — GDPR / PRIVACY

| Control | Status | Evidence / next proof |
|---|---|---|
| Privacy notice | FIXED | `privacy.html` exists; legal review still required. |
| Terms | FIXED | `terms.html` exists; commercial paid-plan terms remain out of scope until paid launch. |
| Source-rights disclosure | FIXED | `sources.html` is fail-closed and distinguishes historical/live/blocked sources. |
| Cookie policy | FAIL | Publish dedicated cookie/storage policy and link it globally. |
| Non-essential scripts blocked before consent | FAIL | Verify deployed HTML/runtime; public Free currently claims no analytics cookies. |
| Data retention matrix | PARTIAL | Privacy page states 90 days anonymous Free events / 12 months account events and beta feedback; needs system-level enforcement proof. |
| Account data export | FAIL | Implement and E2E verify. |
| Account deletion + session revocation | FAIL | Implement and E2E verify. |
| DSAR workflow | PARTIAL | `privacy_requests` exists; verify intake, SLA, identity checks, completion evidence. |
| Processor/subprocessor register | FAIL | Publish current register with purpose, location/transfer mechanism, and DPA status. |
| Incident / breach runbook | FAIL | Create operational runbook including assessment, containment, notification decision and evidence log. |

## P0 — DATA / TRUTH / RIGHTS

| Control | Status | Evidence / next proof |
|---|---|---|
| Unknown remains unknown | VERIFIED | Production safety gate explicitly enforces HOLD behavior for unsupported claims. |
| Verified sales cannot be asserted without evidence | VERIFIED | Safety gate and DB functions enforce NOT_VERIFIED_SALES unless evidence exists. |
| Amazon public-page commercial use | VERIFIED BLOCKED | Source-rights policy defaults analysis/commercial use to false/UNKNOWN. |
| Free dataset rights | FIXED | `sources.html` documents Amazon Products Dataset 2023 / ODC-By conditioned usage. Needs final legal sign-off. |
| Images/descriptions rights | VERIFIED BLOCKED | Public policy states original marketplace images/descriptions are not approved for Free usage. |
| 25 niches x 25 positions | VERIFIED | Live DB: 25 niches, 625 positions, min=max=25. |
| Public 25x25 selection integrity | VERIFIED CODE+CI | Endpoint chooses newest eligible historical 25/25 snapshot and returns 503 unless exactly 25 eligible niches are available; regression tests passed in CI. |
| Freshness of all 625 positions | HISTORICAL BY DESIGN | Free archive is Amazon 2023 and must remain labeled historical. It must never be marketed as current/live. |
| Brand exclusion | FIXED | Brand gate exists; must run duplicate/brand audit over all 625 before release. |
| Per-position source/date/evidence class | FIXED | Endpoint normalizes approved historical source/date/evidence fields; requires 625/625 rendered-output verification before GO. |

## P0 — FREE ECONOMICS / ABUSE

- [ ] Server-side per-user and per-workspace usage counters for every cost-bearing feature.
- [ ] Atomic quota consumption and replay resistance.
- [ ] IP/account rate limiting for every expensive operation.
- [ ] Concurrency ceiling.
- [ ] Provider-cost ceiling.
- [ ] Emergency kill switch.
- [x] No scheduled paid collection in Free by default — production safety gate PASS.
- [x] No paid provider calls by default — production safety gate PASS.
- [x] No Stripe Live / no card collection in Free beta — production safety gate PASS.
- [ ] Abuse test: direct requests, replay, multi-account, malformed payloads, concurrency burst.

## P1 — RELEASE QUALITY

- [ ] Synchronize README and production architecture.
- [ ] Create `PRODUCTION_ARCHITECTURE.md` as single source of truth.
- [ ] Test 404/500/error/timeout/provider-down states.
- [ ] Accessibility pass.
- [x] Automated mobile/cross-platform QA passed on canonical pages; physical-device acceptance still required.
- [ ] Monitoring/alerts and incident ownership.
- [ ] Rollback procedure for deploy + database migrations.
- [ ] Staging/production separation evidence.
- [ ] Support and feedback paths verified.

## 25 x Top 25 quality gate

Do not treat `625` as sufficient by itself. Every one of the 625 positions must pass:

1. niche is one of the approved 25;
2. rank 1..25 exactly once;
3. no duplicate product inside the niche;
4. no established-brand product in commercial shortlist;
5. source identifier present;
6. source rights status allows the displayed fields;
7. observed/snapshot date present;
8. evidence class present;
9. historical/live status explicit;
10. no verified-sales claim without verified sales evidence;
11. no fake profit/volume precision;
12. source link valid where redistribution terms allow linking;
13. product identity is stable and deterministic;
14. no prohibited/regulated category silently promoted;
15. rendering works on mobile and desktop.

## Final GO gate

PUBLIC FREE BETA = GO only when:

- P0 Security: 100% VERIFIED
- P0 GDPR/Privacy: 100% VERIFIED
- P0 Legal/Data rights: 100% VERIFIED or explicitly blocked from public output
- Cross-account leakage: 0
- Free quota bypass: 0
- Critical/High unaccepted vulnerabilities: 0
- 25 niches x 25 positions: 625/625 pass quality gate
- Backup/restore evidence: PASS
- Monitoring/alerts: LIVE
- Mobile critical path: PASS
- Legal footer/pages: public and consistent

Until then verdict remains NO-GO.
