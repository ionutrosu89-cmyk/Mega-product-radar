# Mega Product Radar — Supabase Backup & Restore Runbook V1

Status: P0 production requirement. A paid public launch is NO-GO until a restore drill has completed successfully against a disposable PostgreSQL target.

## Scope

Back up the Supabase PostgreSQL database that contains tenant/application state. Auth/storage/provider-specific backup controls must also remain enabled in the Supabase project according to the subscribed platform plan.

## Required secrets for the manual GitHub workflow

- `SUPABASE_DB_URL_READONLY_BACKUP`: PostgreSQL connection string with the minimum privileges needed by `pg_dump`. Prefer a dedicated backup principal, not the application service-role key.

The secret must exist only in GitHub Actions/approved secret management. Never commit it.

## Drill procedure

1. Run `.github/workflows/backup-restore-drill.yml` manually.
2. The workflow performs `pg_dump --format=custom --no-owner --no-acl` from Supabase.
3. It validates that the archive is non-empty and readable with `pg_restore --list`.
4. It restores the archive into an isolated ephemeral PostgreSQL service owned by the workflow.
5. It verifies core tables after restore: `workspaces`, `workspace_members`, `canonical_products`, `product_aliases`, `subscriptions`.
6. It uploads only a redacted drill report, never the database archive.
7. Record the successful run ID/date in the release checklist.

## Recovery objectives

Initial beta targets until operational data justifies stricter objectives:

- RPO target: <= 24 hours.
- RTO target: <= 4 hours.
- Restore drill cadence: before paid public launch, then at least quarterly and after material database architecture changes.

These are operational targets, not provider guarantees.

## Failure policy

Any failed backup, archive validation or restore verification is a release blocker. Do not waive the failure by changing tests or treating missing tables as empty. Investigate and rerun after remediation.

## Security

The workflow must never upload the `.dump` archive. Logs must not print connection strings or row contents. The disposable restore database contains restored customer data only inside the isolated CI service and is destroyed with the runner.
