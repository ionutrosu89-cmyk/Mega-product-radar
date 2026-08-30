# Mega Product Radar — First Paid Beta Checklist

## Release gate: MUST PASS before charging a real customer

- [ ] Stripe Test Mode products/prices created: Discover €17.90 monthly, Radar €29 monthly, Launch €89 monthly.
- [ ] Deployment secrets configured: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_DISCOVER`, `STRIPE_PRICE_RADAR`, `STRIPE_PRICE_LAUNCH`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `BETA_ANALYTICS_ADMIN_EMAILS` configured.
- [ ] `/api/internal/billing-readiness` returns `ready: true`.
- [ ] Sandbox flow passes: FREE → DISCOVER → RADAR → LAUNCH → cancel-at-period-end → expiry.
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
