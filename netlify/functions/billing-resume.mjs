import { SAAS_CONFIG } from '../../saas-config.js';

async function resolveSubscription(request, { fetchImpl, env }) {
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return { error: 'Authentication required', status: 401 };
  const supabaseUrl = env.SUPABASE_URL || SAAS_CONFIG.supabaseUrl;
  const anon = env.SUPABASE_ANON_KEY || SAAS_CONFIG.supabaseAnonKey;
  const headers = { apikey: anon, authorization: auth, accept: 'application/json' };
  const user = await fetchImpl(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!user.ok) return { error: 'Invalid or expired session', status: 401 };
  const workspaceResponse = await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id&limit=1`, { headers });
  if (!workspaceResponse.ok) return { error: 'Workspace lookup failed', status: 502 };
  const workspace = (await workspaceResponse.json())?.[0];
  if (!workspace) return { error: 'Workspace required', status: 409 };
  const subResponse = await fetchImpl(`${supabaseUrl}/rest/v1/subscriptions?select=status,cancel_at_period_end,provider_subscription_id&workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`, { headers });
  if (!subResponse.ok) return { error: 'Subscription lookup failed', status: 502 };
  const subscription = (await subResponse.json())?.[0];
  return { workspace, subscription };
}

function stripePeriodEnd(subscription) {
  const direct = Number(subscription?.current_period_end);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const itemPeriods = (subscription?.items?.data || []).map(item => Number(item?.current_period_end)).filter(value => Number.isFinite(value) && value > 0);
  return itemPeriods.length ? Math.max(...itemPeriods) : null;
}

export function createBillingResumeHandler({ fetch: fetchImpl = fetch, env = process.env } = {}) {
  return async request => {
    try {
      if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false, error: 'Stripe billing is not configured' }, { status: 503 });
      const state = await resolveSubscription(request, { fetchImpl, env });
      if (state.error) return Response.json({ ok: false, error: state.error }, { status: state.status });
      const sub = state.subscription;
      if (!sub?.provider_subscription_id || !['active', 'trialing', 'past_due'].includes(String(sub.status || '').toLowerCase())) {
        return Response.json({ ok: false, error: 'No active Stripe subscription to resume' }, { status: 409 });
      }
      if (!sub.cancel_at_period_end) {
        return Response.json({ ok: true, unchanged: true, cancelAtPeriodEnd: false }, { headers: { 'Cache-Control': 'private, no-store' } });
      }
      const params = new URLSearchParams({ cancel_at_period_end: 'false' });
      const stripeResponse = await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const stripe = await stripeResponse.json();
      if (!stripeResponse.ok) return Response.json({ ok: false, error: 'Stripe resume request failed' }, { status: 502 });
      const periodEnd = stripePeriodEnd(stripe);
      return Response.json({
        ok: true,
        status: stripe.status || sub.status,
        cancelAtPeriodEnd: Boolean(stripe.cancel_at_period_end),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
      return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
    }
  };
}

export default createBillingResumeHandler();
export const config = { path: '/api/billing/resume', method: 'POST' };
