# Mega Product Radar — Release Candidate / Beta QA

Date: 2026-08-20
Scope: paid-beta commercial journey, access control, billing lifecycle, onboarding, local navigation, legal readiness and release blockers.

## RC verdict

**NOT READY FOR REAL-MONEY PUBLIC LAUNCH YET.**

The application is structurally ready for a controlled beta, but real-money activation remains blocked until Stripe test/live deployment configuration and legal operator details are completed and verified.

## P0 — launch blockers

1. **Stripe environment is not yet proven end-to-end in deployment.** Before any real customer payment, `/api/internal/billing-readiness` must return ready, then a Stripe test subscription must complete through checkout → webhook → Supabase entitlement → access → plan change → cancellation.
2. **Legal operator identity is incomplete.** Terms/Privacy intentionally state that operator identity, legal registration/contact details and support channel must be completed before public commercial launch.
3. **Refund/cancellation/customer-support policy must be finalized for the intended legal/commercial model before accepting real public payments.**

## P1 — beta quality issues

### Fixed in this RC

- Signup now preserves the validated `next` destination instead of always forcing `home.html`. This avoids losing the user's intended Radar/Pricing path after account creation.
- Free pricing copy now says **3 products displayed**, matching the server entitlement, instead of ambiguous “3 views/credits”.
- Added automated commercial journey link/asset checks for beta, pricing, auth, onboarding, Discover, Radar, Launch, Account, feedback and legal pages.
- Added regression checks that Discover/Radar use protected commercial endpoints and that billing lifecycle functions remain present.

### Still requires deployment/browser validation

- Real Stripe sandbox transaction with the deployment secrets and real test Price IDs.
- Webhook delivery/retry behavior from Stripe dashboard.
- iPhone Safari and desktop browser smoke test against the deployed site, including auth email confirmation/reset flow.
- Verify the beta invite always points to `beta.html`; `index.html` remains the legacy/internal intelligence workspace and is not the preferred commercial landing page for beta users.

## P2 — post-beta polish

- Consolidate legacy technical branding (“Radar 7”, old workspace language) into the commercial Mega Product Radar identity.
- Decide whether the public root should eventually become the commercial landing page and move the legacy/internal workspace behind an authenticated/internal route.
- Add customer-facing billing receipts/invoice guidance and support contact once legal/support identity is finalized.
- Continue mobile visual polish after behavior is stable.

## Automated RC acceptance checks

CI must verify:

- all commercial journey pages exist;
- their local HTML assets/links resolve;
- signup and login respect safe local `next` destinations;
- Free pricing entitlement copy matches the server-side 3-product limit;
- Discover does not fetch premium raw discovery JSON directly;
- Radar goes through `/api/commercial/radar`;
- Terms and Privacy retain explicit pre-launch legal blockers;
- checkout, webhook, status, plan-change, cancel and billing-readiness endpoints all remain present;
- existing commercial TEST/HOLD/BUY tests continue to pass.

## Go / no-go rule

Real-money beta is **GO** only after all P0 items are closed. Until then, keep billing in Stripe test/sandbox mode and do not represent legal draft pages as final compliance.
