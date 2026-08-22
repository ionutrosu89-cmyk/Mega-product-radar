import { getStore } from "@netlify/blobs";
import { SAAS_CONFIG } from "../../saas-config.js";
import { hasFeature, planByCode } from "../../billing-plans.js";

const STALE_SCAN_MS = 12 * 60 * 1000;

function scanTimestamp(scan) {
  return scan?.startedAt || scan?.requestedAt || null;
}

function isStale(scan, now = Date.now()) {
  if (!scan || !["queued", "running"].includes(scan.status)) return false;
  const timestamp = scanTimestamp(scan);
  if (!timestamp) return true;
  const time = Date.parse(timestamp);
  return !Number.isFinite(time) || now - time > STALE_SCAN_MS;
}

function strongStore(getStoreImpl) {
  return getStoreImpl({ name: "mega-radar-live", consistency: "strong" });
}

async function resolveAccess(request, { fetchImpl, env }) {
  const auth = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return { error: "Authentication required", status: 401 };

  const supabaseUrl = env.SUPABASE_URL || SAAS_CONFIG.supabaseUrl;
  const apiKey = env.SUPABASE_ANON_KEY || SAAS_CONFIG.supabaseAnonKey;
  const headers = { apikey: apiKey, authorization: auth, accept: "application/json" };

  const userResponse = await fetchImpl(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) return { error: "Invalid or expired session", status: 401 };

  const workspaceResponse = await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,plan&limit=1`, { headers });
  if (!workspaceResponse.ok) return { error: "Workspace lookup failed", status: 502 };
  const workspace = (await workspaceResponse.json())?.[0] || null;
  const plan = planByCode(workspace?.plan || "FREE");
  if (!hasFeature(plan.code, "RADAR")) return { error: "Radar plan required", status: 403, plan: plan.code };

  return { workspaceId: workspace?.id || null, plan: plan.code };
}

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store",
    "Vary": "Authorization"
  };
}

export function createRadarDataHandler({
  getStore: getStoreImpl = getStore,
  fetch: fetchImpl = fetch,
  env = process.env,
  now = () => Date.now()
} = {}) {
  return async request => {
    try {
      const access = await resolveAccess(request, { fetchImpl, env });
      if (access.error) {
        return Response.json({ ok: false, live: false, products: [], error: access.error, plan: access.plan || "FREE" }, {
          status: access.status,
          headers: privateHeaders()
        });
      }

      const store = strongStore(getStoreImpl);
      const raw = await store.get("latest");
      const scanRaw = await store.get("scan-status");
      let scan = scanRaw ? JSON.parse(scanRaw) : { status: "idle" };

      if (isStale(scan, now())) {
        scan = {
          ...scan,
          status: "error",
          completedAt: new Date(now()).toISOString(),
          error: "Scanarea anterioară a expirat. Poți porni din nou Run Scan."
        };
        await store.set("scan-status", JSON.stringify(scan));
      }

      if (!raw) {
        return Response.json({ ok: true, live: false, products: [], scan, plan: access.plan, message: "No live scan yet" }, {
          headers: privateHeaders()
        });
      }

      const payload = JSON.parse(raw);
      return Response.json({ ok: true, live: true, scan, plan: access.plan, workspaceId: access.workspaceId, ...payload }, {
        headers: privateHeaders()
      });
    } catch (error) {
      return Response.json({ ok: false, live: false, products: [], error: String(error?.message || error) }, {
        status: 500,
        headers: privateHeaders()
      });
    }
  };
}

export default createRadarDataHandler();

export const config = {
  path: "/api/radar/data",
  method: "GET"
};
