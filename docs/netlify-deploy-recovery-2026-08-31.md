# Netlify deploy recovery — 2026-08-31

Observed failure: `ERR_PNPM_OUTDATED_LOCKFILE` during Netlify initialization because `pnpm-lock.yaml` pinned `@netlify/blobs` 10.7.12 while `package.json` required 10.7.13.

Resolution: npm is the canonical package manager. `package-lock.json` is synchronized with 10.7.13, the stale pnpm lockfile is removed, and repository checks reject future competing lockfiles.
