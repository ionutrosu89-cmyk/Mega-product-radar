# Production Deployment Policy V1

Canonical production SaaS target: **Netlify**.

- GitHub is the source repository, CI system and data-workflow host.
- Netlify serves the customer web application and protected API/functions.
- Supabase provides Auth/PostgreSQL/RLS/application data.
- GitHub Pages is not a supported production SaaS target. Any Pages artifact is staging/internal only and must not be treated as the billing/authenticated production surface.

The build must never publish private supplier/RFQ/manual evidence artifacts into `_site`.
