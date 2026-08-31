# Netlify package manager

Mega Product Radar uses npm as its canonical package manager in CI and Netlify production builds.

The repository must keep `package.json` and `package-lock.json` synchronized. Do not add a competing `pnpm-lock.yaml` or `yarn.lock` unless the deployment and CI strategy is intentionally migrated and validated end to end.
