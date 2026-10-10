# Isolated billing Sandbox — pending activation

The current private preview blocks GitHub runner traffic and third-party Stripe webhooks. This change prepares an API-only test environment; it does not create a Netlify project, change visibility or activate billing.

Enable MPR_SANDBOX_ISOLATION=true, configure a dedicated UUID MPR_SANDBOX_WORKSPACE_ID and the exact hostname MPR_SANDBOX_HOST. Only sk_test_ credentials and a test webhook signing secret are allowed. Configure the Edge function sandbox-perimeter explicitly on /* in a dedicated deployment; it has no automatic path export and is not enabled on current deployments. The initial perimeter intentionally denies all UI, product, checkout and direct function alias routes. It admits only the seven enumerated internal/webhook routes to their existing authentication handlers. A header's presence never constitutes verified identity.

Before activation: verify Netlify quotas/costs, use isolated Supabase test credentials with no production fallback, disable scheduled scans/collectors in the dedicated deployment, review packaging to avoid exposing static artifacts, configure only supported Stripe subscription/checkout test events, and obtain explicit approval for external endpoint exposure. Do not copy Live keys or production service credentials into this environment. Database isolation is an operational requirement not proved by these unit tests.

The webhook isolation guard rejects missing/Live event or object modes, malformed configuration and any metadata/client reference outside the dedicated workspace before event claiming or database access. Production behavior is unchanged unless isolation is explicitly enabled.

Required deployed evidence remains: actual Edge routing, unauthorized/foreign request rejection, valid test Stripe delivery, the six webhook-backed billing checkpoints, return to Free and zero real-money operations. The prepared code and tests are not release acceptance or proof that the new environment exists.
