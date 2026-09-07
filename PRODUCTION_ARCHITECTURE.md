# Mega Product Radar — Production Architecture

Status: canonical production reference
Version: 2026-09-07
Target release: PUBLIC FREE BETA

## 1. Runtime

- Public web application: Netlify static site + Netlify Functions.
- Database/Auth: Supabase PostgreSQL + Supabase Auth.
- Node runtime policy: Node >=22.
- Production build is gated by package-manager validation, project checks, migration-chain verification, production-safety invariants, public-bundle hardening, secret-value scan and mobile QA.

GitHub Pages is not the canonical production target. Old GitHub Pages/scanner references are legacy history unless explicitly marked otherwise.

## 2. Public Free Beta contract

Public Free Beta is intentionally fail-closed:

- no card required;
- no Stripe Live billing;
- paid-provider calls disabled by default;
- scheduled paid collection disabled by default;
- no provider data spend by default;
- public Free Top25 uses approved licensed historical evidence only;
- live/dynamic marketplace evidence is held unless a separate server-side rights approval exists;
- unsupported facts remain unknown rather than estimated as verified facts.

Canonical public historical endpoint: `/api/free/top25`.

Dynamic live niche route `/api/free/niches` is rights-held by default and must not be opened merely because a public source can technically be fetched.

## 3. Data trust hierarchy

1. VERIFIED — direct evidence adequate for the exact claim.
2. DERIVED — deterministic calculation from cited evidence.
3. ESTIMATED — explicitly labelled estimate with assumptions.
4. INSUFFICIENT DATA — no publication of unsupported precision.

Sales, profit, landed cost, competition and trend are separate claim classes. A rank, review count or viral signal is never automatically converted into verified sales.

## 4. Tenant security model

- Browser roles: `anon` / `authenticated`.
- Privileged server role: `service_role`, server-side only.
- Tenant tables exposed to authenticated clients require RLS.
- Sensitive server-only tables additionally rely on grant denial.
- Browser roles must not have `TRUNCATE`, `TRIGGER` or `REFERENCES` privileges on public tables.
- Current privileged `SECURITY DEFINER` functions are service-only and use constrained search paths.
- Public views intended to respect caller security use `security_invoker=true`.
- Future privileged functions require explicit grants; default browser execution is not assumed.

## 5. Public bundle rules

The deployed `_site` artifact must:

- contain only public application/legal assets;
- exclude internal runbooks, launch audits and operational checklists;
- pass secret-value scanning, including service-role JWT detection;
- never expose Supabase service-role, Stripe secret, webhook secret, paid-provider credentials or security salts.

## 6. Source-rights model

Technical reachability is not legal permission to redistribute.

Every source has a rights decision. For Public Free Beta:

- approved licensed historical datasets may be published within documented conditions;
- marketplace public-page automation is not automatically approved for customer-visible redistribution;
- images, long descriptions, reviews and branded promotional assets require separate rights assessment;
- a source in HOLD/STOP cannot silently enter customer-facing scores.

## 7. Free 25 × Top 25

Release invariant:

- exactly 25 approved niches;
- exactly 25 eligible positions per niche;
- 625 eligible positions total;
- deterministic rank 1..25;
- provenance and historical/live class on every position;
- no unsupported verified-sales claim;
- brand/commercial gate preserved;
- endpoint returns fail-closed rather than padding with weaker evidence.

## 8. Authentication and privacy

- Auth tokens come from Supabase Auth.
- Service-role keys are used only in server functions.
- Account export and deletion are authenticated server-side operations.
- Deletion requires explicit confirmation and is blocked by unresolved active billing.
- Public Free marketing/advertising trackers are not part of the release contract.
- Cookie/storage, privacy, terms and subprocessor reviews are mandatory legal-readiness inputs.

## 9. Deploy and database changes

- Database DDL is represented in `supabase/migrations`.
- Production DB fixes must be synchronized back into the migration chain.
- CI must remain green before promotion.
- Do not bypass fail-closed production-safety gates to recover a broken deploy.

## 10. Release decision

`PUBLIC FREE BETA = GO` only when every P0 in `PUBLIC_FREE_LAUNCH_AUDIT.md` is VERIFIED. A green build is necessary but not sufficient: unresolved Auth configuration, contractual/legal reviews, cross-tenant E2E or operational controls can still keep the release in NO-GO.
