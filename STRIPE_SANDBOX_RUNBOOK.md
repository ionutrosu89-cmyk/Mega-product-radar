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
- `MPR_READINESS_PROBE_TOKEN` for protected machine-run readiness and sandbox evidence capture

For an operator terminal or protected GitHub Actions run, configure without committing values:

- `MPR_BASE_URL` = the HTTPS deployment that actually serves Netlify Functions
- `MPR_READINESS_PROBE_TOKEN` = the same protected probe token configured server-side
- `MPR_SANDBOX_WORKSPACE_ID` = the dedicated sandbox workspace ID
- optionally `MPR_BILLING_JOURNEY_EVIDENCE` = output path for the evidence JSON

`MPR_BILLING_TEST_WORKSPACE_ID` remains accepted by the checkpoint recorder only as a backward-compatible fallback. New configuration should use `MPR_SANDBOX_WORKSPACE_ID` everywhere.

Never place any of these values in source control or paste secret values into tickets, screenshots, logs, or chat.

## Webhook endpoint
Configure the Stripe Test Mode webhook endpoint to:

`https://<production-or-preview-domain>/api/billing/webhook`

Subscribe at minimum to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The application deliberately does not grant paid entitlement from `checkout.session.completed` alone. Paid access is granted only when the Stripe subscription status is `active` or `trialing`.

## Readiness and clean-workspace preflight
Before opening Stripe Checkout, run the paid-beta deployment acceptance gate in `SANDBOX` mode. It checks billing configuration, database runtime readiness, and the dedicated sandbox workspace through `GET /api/internal/billing-journey-snapshot`.

A SANDBOX `GO` requires all of the following before the first checkout:

- billing readiness is `ready: true` in Stripe Test Mode;
- all three active monthly EUR prices are valid at 1790 / 2900 / 8900 cents;
- webhook secret and required server-side billing configuration are present;
- paid-beta database runtime/migrations are ready;
- the exact `MPR_SANDBOX_WORKSPACE_ID` exists;
- workspace entitlement is `FREE`;
- Stripe reports zero `active` or `trialing` subscriptions for that workspace customer;
- no cancellation-at-period-end residue is active;
- local subscription status is absent or terminal/inactive, never an active paid state.

If any of these checks fail, the acceptance workflow returns NO-GO and checkout must not start. The preflight performs no purchase, no checkout creation and no real-money charge.

## End-to-end sandbox test order
1. Pass the automated SANDBOX deployment + clean-workspace preflight.
2. Capture `FREE_BASELINE`.
3. Buy Discover using Stripe Test Mode.
4. Confirm webhook changes Supabase workspace + subscription to DISCOVER / active, then capture `DISCOVER_ACTIVE`.
5. Confirm Discover full access and Radar remains locked.
6. Change Discover -> Radar; verify the existing Stripe subscription is changed rather than creating another active subscription, then capture `RADAR_ACTIVE`.
7. Confirm Radar access and Launch remains locked.
8. Change Radar -> Launch and confirm access, then capture `LAUNCH_ACTIVE`.
9. Cancel at period end; confirm `cancel_at_period_end=true` while access remains active until period end, then capture `CANCEL_SCHEDULED`.
10. Simulate/receive subscription deletion/ended status; confirm workspace entitlement falls back to FREE, then capture `ENDED_FREE`.
11. Verify Beta Analytics shows paid workspace once, not duplicated by page refreshes.
12. Run the final machine verifier and require `GO`.

## Automated checkpoint capture
The protected endpoint `GET /api/internal/billing-journey-snapshot` is SANDBOX-only. It reads workspace/subscription state from Supabase, asks Stripe for all subscriptions belonging to the recorded sandbox customer, and reports the count of `active`/`trialing` subscriptions. This makes duplicate paid subscriptions visible to the acceptance gate while keeping customer identity, email, card data and secret values out of the response.

Capture each checkpoint immediately after the corresponding webhook-backed state is visible:

```bash
npm run capture:billing-journey-checkpoint -- FREE_BASELINE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- DISCOVER_ACTIVE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- RADAR_ACTIVE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- LAUNCH_ACTIVE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- CANCEL_SCHEDULED billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- ENDED_FREE billing-journey-evidence.json
```

The recorder refuses stages out of order, a different workspace, live Stripe mode, an already-complete journey, or a snapshot that cannot prove Stripe active-subscription count. It builds the final evidence file automatically; operators should not hand-edit the checkpoint fields.

After the sixth checkpoint:

```bash
npm run verify:billing-journey-evidence -- billing-journey-evidence.json
```

Only a final `GO` is acceptable evidence for the `BILLING_E2E` launch-readiness check.

## Machine-verifiable journey evidence
Do not treat screenshots or a manually checked box as proof of the complete billing journey. The generated artifact contains only non-secret operational evidence. Never store Stripe keys, webhook secrets, Supabase keys, customer email, card data, payment method data, or Stripe customer IDs in this artifact.

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

A `GO` verdict requires all six checkpoints in order, the same workspace, one and the same Stripe subscription throughout all paid stages, exactly one active subscription while paid, unique lifecycle webhook event IDs, active/trialing status for paid entitlement, scheduled cancellation while Launch remains active, and terminal fallback to FREE with zero active subscriptions. This verifier is intentionally SANDBOX-only and rejects evidence marked as real-money.

## Acceptance criteria before first paid beta customer
- Automated SANDBOX deployment preflight returns `GO` for the dedicated FREE workspace.
- One full sandbox payment succeeds.
- Automated checkpoint capture completes all six stages without manual evidence edits.
- `verify:billing-journey-evidence` returns `GO` for the captured full journey.
- `BILLING_E2E` can PASS only from verified journey evidence.
- Upgrade does not create a duplicate subscription.
- Cancellation keeps access until period end and then removes it.
- Past-due/unpaid/canceled status does not retain paid entitlement.
- Discover/Radar/Launch server-side entitlements match the Stripe-backed workspace plan.
- No Stripe or Supabase service-role secret appears in Git, browser payloads, logs, client-side JavaScript, or the journey evidence artifact.
