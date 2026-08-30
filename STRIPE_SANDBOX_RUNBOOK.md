# Stripe Sandbox Runbook

## Products and monthly prices
Create three recurring monthly EUR prices in Stripe Test Mode:

- Discover: EUR 17.90 / month -> `STRIPE_PRICE_DISCOVER`
- Radar: EUR 29.00 / month -> `STRIPE_PRICE_RADAR`
- Launch: EUR 89.00 / month -> `STRIPE_PRICE_LAUNCH`

Do not use one-time prices. All three must be active recurring monthly prices in EUR.

## Deployment environment variables
Configure these only in the deployment secret/environment settings, never in Git:

- `STRIPE_SECRET_KEY` (test secret key while sandbox testing)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_DISCOVER`
- `STRIPE_PRICE_RADAR`
- `STRIPE_PRICE_LAUNCH`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BETA_ANALYTICS_ADMIN_EMAILS` for access to internal readiness/analytics dashboards

## Webhook endpoint
Configure the Stripe Test Mode webhook endpoint to:

`https://<production-or-preview-domain>/api/billing/webhook`

Subscribe at minimum to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The application deliberately does not grant paid entitlement from `checkout.session.completed` alone. Paid access is granted only when the Stripe subscription status is `active` or `trialing`.

## Readiness check
After deployment and secret configuration, authenticate with an admin allowlisted account and call:

`GET /api/internal/billing-readiness`

A safe response contains only presence flags and validated Stripe price metadata; it never returns secret values.

`ready: true` requires:

- every required secret/ID present;
- all three Stripe Price IDs valid and active;
- currency EUR;
- recurring interval monthly;
- exact unit amounts 1790 / 2900 / 8900 cents.

## End-to-end sandbox test order
1. Start on FREE.
2. Buy Discover using Stripe Test Mode.
3. Confirm webhook changes Supabase workspace + subscription to DISCOVER / active.
4. Confirm Discover full access and Radar remains locked.
5. Change Discover -> Radar; verify the existing Stripe subscription is changed rather than creating another active subscription.
6. Confirm Radar access and Launch remains locked.
7. Change Radar -> Launch and confirm access.
8. Cancel at period end; confirm `cancel_at_period_end=true` while access remains active until period end.
9. Simulate/receive subscription deletion/ended status; confirm workspace entitlement falls back to FREE.
10. Verify Beta Analytics shows paid workspace once, not duplicated by page refreshes.

## Machine-verifiable journey evidence
Do not treat screenshots or a manually checked box as proof of the complete billing journey. After each sandbox checkpoint, record only non-secret operational evidence in one local JSON file. Never store Stripe keys, webhook secrets, Supabase keys, customer email, card data, or payment method data in this artifact.

Required schema and stages:

```json
{
  "schema": "MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1",
  "environment": "SANDBOX",
  "workspaceId": "<test-workspace-id>",
  "checkout": {"mode": "SUBSCRIPTION", "currency": "EUR", "realMoney": false},
  "checkpoints": [
    {"stage":"FREE_BASELINE","workspaceId":"<same>","workspacePlan":"FREE","subscriptionStatus":"none","providerSubscriptionId":"","activeSubscriptionCount":0,"cancelAtPeriodEnd":false,"lastStripeEventId":"","observedAt":"<ISO time>"},
    {"stage":"DISCOVER_ACTIVE","workspaceId":"<same>","workspacePlan":"DISCOVER","subscriptionStatus":"active","providerSubscriptionId":"<sub id>","activeSubscriptionCount":1,"cancelAtPeriodEnd":false,"lastStripeEventId":"<event id>","observedAt":"<ISO time>"},
    {"stage":"RADAR_ACTIVE","workspaceId":"<same>","workspacePlan":"RADAR","subscriptionStatus":"active","providerSubscriptionId":"<same sub id>","activeSubscriptionCount":1,"cancelAtPeriodEnd":false,"lastStripeEventId":"<new event id>","observedAt":"<ISO time>"},
    {"stage":"LAUNCH_ACTIVE","workspaceId":"<same>","workspacePlan":"LAUNCH","subscriptionStatus":"active","providerSubscriptionId":"<same sub id>","activeSubscriptionCount":1,"cancelAtPeriodEnd":false,"lastStripeEventId":"<new event id>","observedAt":"<ISO time>"},
    {"stage":"CANCEL_SCHEDULED","workspaceId":"<same>","workspacePlan":"LAUNCH","subscriptionStatus":"active","providerSubscriptionId":"<same sub id>","activeSubscriptionCount":1,"cancelAtPeriodEnd":true,"lastStripeEventId":"<new event id>","observedAt":"<ISO time>"},
    {"stage":"ENDED_FREE","workspaceId":"<same>","workspacePlan":"FREE","subscriptionStatus":"canceled","providerSubscriptionId":"<same sub id>","activeSubscriptionCount":0,"cancelAtPeriodEnd":false,"lastStripeEventId":"<new event id>","observedAt":"<ISO time>"}
  ]
}
```

Validate it with:

`npm run verify:billing-journey-evidence -- path/to/evidence.json`

A `GO` verdict requires all six checkpoints in order, the same workspace, one and the same Stripe subscription throughout all paid stages, exactly one active subscription while paid, unique lifecycle webhook event IDs, active/trialing status for paid entitlement, scheduled cancellation while Launch remains active, and terminal fallback to FREE with zero active subscriptions. This verifier is intentionally SANDBOX-only and rejects evidence marked as real-money.

## Acceptance criteria before first paid beta customer
- Readiness endpoint returns `ready: true`.
- One full sandbox payment succeeds.
- `verify:billing-journey-evidence` returns `GO` for the captured full journey.
- Upgrade does not create a duplicate subscription.
- Cancellation keeps access until period end and then removes it.
- Past-due/unpaid/canceled status does not retain paid entitlement.
- Discover/Radar/Launch server-side entitlements match the Stripe-backed workspace plan.
- No Stripe or Supabase service-role secret appears in Git, browser payloads, logs, client-side JavaScript, or the journey evidence artifact.
