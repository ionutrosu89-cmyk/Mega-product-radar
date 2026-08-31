# Mega Product Radar — First Paid Beta Checklist

## Release gate: MUST PASS before charging a real customer

- [ ] Stripe Test Mode products/prices created: Discover €17.90 monthly, Radar €29 monthly, Launch €89 monthly.
- [ ] Deployment secrets configured: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_DISCOVER`, `STRIPE_PRICE_RADAR`, `STRIPE_PRICE_LAUNCH`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `BETA_ANALYTICS_ADMIN_EMAILS`, `MPR_READINESS_PROBE_TOKEN` and `MPR_SANDBOX_WORKSPACE_ID` configured server-side.
- [ ] Current deployment has a stable release identity (`COMMIT_REF`, `DEPLOY_ID` or explicit `MPR_DEPLOYMENT_REF`) so E2E evidence cannot be reused across releases.
- [ ] `/api/internal/billing-readiness` returns `ready: true` in Stripe Test Mode.
- [ ] Supabase migrations are applied through `20260831_billing_e2e_acceptance.sql` before any payment test.
- [ ] `/api/internal/paid-beta-runtime-readiness` returns `ready: true`, proving the Stripe ordering columns, webhook event state and atomic entitlement RPC exist in the deployed database.
- [ ] `/api/internal/sandbox-preflight-readiness` reports the dedicated workspace CLEAN: FREE, zero active/trialing subscriptions and no cancellation residue.
- [ ] Server-owned E2E ledger starts at `FREE_BASELINE` only after billing + runtime preflight pass.
- [ ] Sandbox flow passes: FREE → DISCOVER → RADAR → LAUNCH → cancel-at-period-end → expiry.
- [ ] All six checkpoints are captured by `/api/internal/billing-e2e-acceptance` from Stripe/Supabase state, in exact order, without client-authored evidence fields.
- [ ] Current deployment's server-owned billing E2E ledger reaches `GO` with exactly six checkpoints.
- [ ] `BILLING_E2E` launch readiness PASS is derived only from that current-deployment server GO. A local JSON artifact or old deployment PASS is not release authority.
- [ ] No duplicate Stripe subscriptions after changing plan.
- [ ] Failed Stripe webhook delivery is retried successfully with the same event id and grants/revokes entitlement exactly once.
- [ ] Out-of-order or same-second ambiguous Stripe lifecycle events cannot restore or increase entitlement over a newer/safer state.
- [ ] Paid access is granted only from active/trialing subscription webhook state.
- [ ] Discover/Radar/Launch paywalls verified in a clean browser session.
- [ ] Legal release variables configured server-side: `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_VAT`, `LEGAL_OPERATOR_REGISTRY`, `LEGAL_OPERATOR_ADDRESS`, `LEGAL_SUPPORT_EMAIL`.
- [ ] Refund/cancellation policy is approved and `LEGAL_REFUND_POLICY_APPROVED=true`.
- [ ] Terms and Privacy reviewed by a qualified Romanian/EU professional and review dates recorded in `LEGAL_TERMS_REVIEWED_AT` / `LEGAL_PRIVACY_REVIEWED_AT`.
- [ ] `/api/internal/legal-readiness` returns `ready: true`.
- [ ] The same approved operator details are visibly published in Terms/Privacy before real-money public sales.
- [ ] Cookie/consent review completed before adding non-essential analytics or marketing tags.

## First 5–10 beta users

1. Invite users manually. Do not open public paid acquisition yet.
2. Ask every user to finish seller onboarding before evaluating Radar.
3. Observe their first session: can they explain Discover vs Radar vs Launch without help?
4. Ask them to validate one real product, not browse randomly.
5. Collect feedback through `beta-feedback.html` after the first meaningful session.
6. Track funnel in `beta-analytics.html`: onboarding, Discover, Radar, Launch, upgrade intent, paid.
7. Record every support question; repeated questions are UX bugs until proven otherwise.
8. Do not alter TEST/HOLD gates to improve conversion metrics.
9. Do not advertise estimated sales as verified sales.
10. After 5 users, review feedback before inviting the next 5.

## Success criteria for moving out of controlled beta

- ≥80% onboarding completion among invited users.
- ≥60% of activated users reach Discover.
- ≥30% of Discover users reach Radar or explicitly attempt Radar upgrade.
- At least 3 users validate a real product end-to-end.
- No billing entitlement incidents.
- No premium data leakage from direct URLs/browser manipulation.
- No unresolved P0/P1 security or billing defects.
- At least 3 qualitative confirmations that the Romania + sourcing + economics layer is more useful than a generic trend list.

These are product gates, not revenue forecasts. Do not lower commercial evidence standards to hit them.
