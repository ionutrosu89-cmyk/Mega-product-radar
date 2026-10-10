# Mega Product Radar — Supabase activation

Production policy: **`supabase/migrations/` is the only supported database source of truth.** `supabase/schema.sql` is retained as a legacy reference snapshot and MUST NOT be used to bootstrap a new environment.

## Fresh environment

1. Create a Supabase project owned by the business.
2. Apply every SQL file in `supabase/migrations/`, starting with `20260819_baseline_schema.sql`. Use lexical order except the day-only groups listed in `supabase/legacy-migration-order.json`: those groups must follow the explicit historical dependency order. Alphabetical sorting alone is unsafe (for example, it runs the Romania inbox guard before the inbox).
3. Enable Email/Password Auth and configure the Netlify production URL as Site URL/redirect URL.
4. Put only the public Project URL + anon/publishable key in the browser configuration.
5. Configure service-role/Stripe/internal secrets only in Netlify environment variables. Never commit them.
6. Run CI and the migration-chain verification before release.
7. Verify with two separate users that RLS prevents cross-workspace reads/writes.
8. Run the backup/restore readiness procedure before public paid launch.

## Existing environment

### Isolated clean replay

The `Clean Supabase Migration Replay` GitHub workflow starts a disposable local Supabase Docker database, using CLI 2.117.0, without any production credentials. `node scripts/replay-clean-database.mjs` executes all repository SQL files once in the documented order, then every transactional test in `supabase/tests/`. It refuses an already populated application schema and only targets `supabase_db_mpr-clean-replay`; it does not accept a remote database URL. The JSON artifact records each migration hash, outcome and failing SQL error. This is actual SQL execution; `npm run verify:migrations` only checks repository structure.

The legacy 10K catalogue data migration leaves a completely empty catalogue empty. Its exact-count guard remains mandatory for populated databases. Importing and validating commercial data is a separate step; a clean schema replay does not prove that every production data backfill has been reproduced.

The repository contains consolidated legacy migrations, not a byte-for-byte export of every historical production migration. A clean replay proves this repository chain can install; it is not a claim of complete production schema/data equivalence.

Apply only migrations not already applied. Do not re-run `schema.sql` over a live database. Migrations are designed to be additive/idempotent where practical, but production changes still require a database backup and a tested rollback/restore path.

## Tenant boundary

Workspace membership is the tenant boundary. Protected customer APIs must require explicit `X-MPR-Workspace-Id` context and validate membership server-side. Money-sensitive subscription mutations are OWNER-only.
