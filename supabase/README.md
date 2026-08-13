# Mega Product Radar 7.0 — Supabase activation

Radar 7 ships with a SaaS-ready schema and login/workspace UI, but no private keys are committed.

Activation steps:
1. Create a Supabase project owned by the business.
2. Run `supabase/schema.sql` in the SQL editor.
3. In Auth, enable Email/Password and set the GitHub Pages URL as Site URL/redirect URL.
4. Copy only the public Project URL and anon/publishable key into `saas-config.js`.
5. Never commit a service-role key.
6. Re-run CI and verify two separate test users cannot read each other's workspace rows.

RLS is enabled on all tenant tables. Workspace membership is the tenant boundary. Billing tables are foundation-only until Stripe is connected in a later release.
