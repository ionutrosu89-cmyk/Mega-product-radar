# Mega Product Radar — Deployment Setup Guide

## Scope
This guide prepares the first Stripe sandbox transaction. It does not authorize real-money public launch by itself.

## 1. Stripe Test Mode
Create three recurring monthly prices in EUR:
- Discover — EUR 17.90 / month
- Radar — EUR 29.00 / month
- Launch — EUR 89.00 / month

Keep the resulting `price_...` IDs. Do not commit secret keys or webhook secrets to GitHub.

## 2. Netlify environment variables
Configure these server-side variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_DISCOVER`
- `STRIPE_PRICE_RADAR`
- `STRIPE_PRICE_LAUNCH`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BETA_ANALYTICS_ADMIN_EMAILS`

The public Supabase anon key remains client-safe; the service role key does not.

## 3. Stripe webhook
Point the Stripe test webhook to the deployed billing webhook route used by Mega Product Radar. Copy the Stripe signing secret into `STRIPE_WEBHOOK_SECRET`.

Do not grant paid access on browser redirects. Entitlement changes are driven by verified subscription webhook state.

## 4. Protected diagnostic
Sign in with an email present in `BETA_ANALYTICS_ADMIN_EMAILS`, then open `deployment-readiness.html` and run the check.

Technical GO requires all of the following:
- all required environment variables are present;
- all three Stripe prices resolve successfully;
- prices are active;
- currency is EUR;
- recurring interval is monthly;
- exact amounts are EUR 17.90 / 29.00 / 89.00.

No secret values are returned to the browser.

## 5. Sandbox acceptance sequence
Run the same workspace through:
1. FREE
2. DISCOVER checkout
3. confirm workspace entitlement = DISCOVER
4. change plan to RADAR without creating a second active subscription
5. change plan to LAUNCH without creating a second active subscription
6. cancel at period end
7. confirm access remains valid until the paid period ends
8. confirm non-active subscription state does not grant paid entitlement

A failed step is a release blocker.

## 6. Real-money release gate
Before switching to live Stripe keys, close the legal P0 items in `RELEASE_CANDIDATE_AUDIT.md` and `BETA_LAUNCH_CHECKLIST.md`, including operator identity, official support contact, cancellation/refund terms and appropriate Romania/EU legal review.
