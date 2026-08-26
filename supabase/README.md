# Mega Product Radar — Supabase activation

Production policy: **`supabase/migrations/` is the only supported database source of truth.** `supabase/schema.sql` is retained as a legacy reference snapshot and MUST NOT be used to bootstrap a new environment.

## Fresh environment

1. Create a Supabase project owned by the business.
2. Apply every SQL file in `supabase/migrations/` in lexical/chronological order, starting with `20260819_baseline_schema.sql`.
3. Enable Email/Password Auth and configure the Netlify production URL as Site URL/redirect URL.
4. Put only the public Project URL + anon/publishable key in the browser configuration.
5. Configure service-role/Stripe/internal secrets only in Netlify environment variables. Never commit them.
6. Run CI and the migration-chain verification before release.
7. Verify with two separate users that RLS prevents cross-workspace reads/writes.
8. Run the backup/restore readiness procedure before public paid launch.

## Existing environment

Apply only migrations not already applied. Do not re-run `schema.sql` over a live database. Migrations are designed to be additive/idempotent where practical, but production changes still require a database backup and a tested rollback/restore path.

## Tenant boundary

Workspace membership is the tenant boundary. Protected customer APIs must require explicit `X-MPR-Workspace-Id` context and validate membership server-side. Money-sensitive subscription mutations are OWNER-only.
