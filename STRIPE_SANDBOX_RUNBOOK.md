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
- `MPR_SANDBOX_WORKSPACE_ID` for the dedicated sandbox workspace

Netlify normally supplies `COMMIT_REF` / `DEPLOY_ID`. `MPR_DEPLOYMENT_REF` may be supplied explicitly by an equivalent deployment environment. Billing E2E acceptance refuses to run unless it can bind evidence to one deployed release identity of at least seven characters.

For an operator terminal or protected GitHub Actions run, configure without committing values:

- `MPR_BASE_URL` = the HTTPS deployment that actually serves Netlify Functions
- `MPR_READINESS_PROBE_TOKEN` = the same protected probe token configured server-side
- `MPR_SANDBOX_WORKSPACE_ID` = the dedicated sandbox workspace ID
- optionally `MPR_BILLING_JOURNEY_EVIDENCE` = local debugging artifact path only

`MPR_BILLING_TEST_WORKSPACE_ID` remains accepted by the legacy checkpoint recorder only as a backward-compatible fallback. New configuration should use `MPR_SANDBOX_WORKSPACE_ID` everywhere.

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
Before opening Stripe Checkout, run the paid-beta deployment acceptance gate in `SANDBOX` mode. It checks billing configuration, database runtime readiness, and the dedicated sandbox workspace.

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

If any check fails, acceptance returns NO-GO and checkout must not start. The preflight performs no purchase, no checkout creation and no real-money charge.

## Authoritative server-owned E2E ledger
The release authority for `BILLING_E2E` is `POST /api/internal/billing-e2e-acceptance`, not a JSON file uploaded from a browser or operator terminal.

The endpoint:

- is protected by the readiness/admin authorization layer;
- reads the dedicated workspace ID only from server environment;
- captures every checkpoint itself from Supabase + Stripe through the protected snapshot handler;
- validates every partial state immediately before it can enter the ledger;
- stores evidence in `billing_e2e_acceptance_runs`, which is service-role-only behind RLS;
- binds the run to the current deployment reference;
- uses optimistic version fencing so concurrent checkpoint writes fail closed;
- becomes `GO` only after all six exact checkpoints pass the final verifier;
- never returns workspace ID, Stripe customer ID, subscription ID, webhook event IDs, card data or the stored evidence payload to the browser.

A `GO` from an older deploy is deliberately not accepted for a newer deploy. After a new deployment, the current deployment must earn its own billing E2E GO before `BILLING_E2E` can count as PASS in launch readiness.

## End-to-end sandbox test order
1. Pass automated SANDBOX deployment + clean-workspace preflight.
2. Capture `FREE_BASELINE` server-side through `/api/internal/billing-e2e-acceptance`.
3. Buy Discover using Stripe Test Mode.
4. Confirm webhook changes Supabase workspace + subscription to DISCOVER / active, then capture `DISCOVER_ACTIVE` server-side.
5. Confirm Discover full access and Radar remains locked.
6. Change Discover -> Radar; verify the existing Stripe subscription is changed rather than creating another active subscription, then capture `RADAR_ACTIVE`.
7. Confirm Radar access and Launch remains locked.
8. Change Radar -> Launch and confirm access, then capture `LAUNCH_ACTIVE`.
9. Cancel at period end; confirm `cancel_at_period_end=true` while access remains active until period end, then capture `CANCEL_SCHEDULED`.
10. Simulate/receive subscription deletion/ended status; confirm workspace entitlement falls back to FREE, then capture `ENDED_FREE`.
11. Confirm `GET /api/internal/billing-e2e-acceptance` reports six checkpoints and `verdict: GO` for the current deployment.
12. Only then mark `BILLING_E2E` PASS through launch readiness; that endpoint re-reads the server ledger and ignores client-supplied journey JSON as authority.

## Local checkpoint artifact: debugging only
The CLI recorder remains useful for operator diagnostics:

```bash
npm run capture:billing-journey-checkpoint -- FREE_BASELINE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- DISCOVER_ACTIVE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- RADAR_ACTIVE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- LAUNCH_ACTIVE billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- CANCEL_SCHEDULED billing-journey-evidence.json
npm run capture:billing-journey-checkpoint -- ENDED_FREE billing-journey-evidence.json
npm run verify:billing-journey-evidence -- billing-journey-evidence.json
```

The recorder refuses stages out of order, a different workspace, live Stripe mode, an already-complete journey, or any partial state that fails the same truth semantics used by the final verifier.

A local verifier `GO` is useful debugging evidence, but it is **not** sufficient to set the production launch registry `BILLING_E2E` to PASS. The launch gate trusts only the current deployment's server-owned acceptance ledger.

## Machine-verifiable truth contract
The authoritative journey still enforces:

- exact ordered stages: `FREE_BASELINE`, `DISCOVER_ACTIVE`, `RADAR_ACTIVE`, `LAUNCH_ACTIVE`, `CANCEL_SCHEDULED`, `ENDED_FREE`;
- same workspace throughout;
- one and the same Stripe subscription throughout all paid and terminal stages;
- numeric active subscription count `0` at baseline and terminal state;
- exactly one active/trialing subscription at every paid stage;
- unique lifecycle webhook event IDs for paid and terminal transitions;
- paid entitlement only for active/trialing;
- cancellation-at-period-end retains Launch while the provider subscription is still active/trialing;
- terminal status must be one of the recognized non-paid states and workspace must return to FREE;
- SANDBOX only, EUR recurring subscription checkout, `realMoney: false`.

Missing numeric counts, missing terminal status, missing subscription identity, duplicate lifecycle event IDs, reordered stages, a second Stripe subscription, live Stripe evidence or ambiguous incomplete state all fail closed.

## Acceptance criteria before first paid beta customer
- Automated SANDBOX deployment preflight returns `GO` for the dedicated FREE workspace.
- The deployed database contains `billing_e2e_acceptance_runs` and the complete billing runtime migrations.
- One full sandbox payment succeeds.
- All six checkpoints are captured by the server-owned endpoint in exact order.
- Current deployment acceptance reports `GO`.
- `BILLING_E2E` can PASS only from that current-deployment server GO.
- Upgrade does not create a duplicate subscription.
- Cancellation keeps access until period end and then removes it.
- Past-due/unpaid/canceled status does not retain paid entitlement.
- Discover/Radar/Launch server-side entitlements match the Stripe-backed workspace plan.
- No Stripe or Supabase service-role secret appears in Git, browser payloads, logs, client-side JavaScript, or local journey artifacts.
