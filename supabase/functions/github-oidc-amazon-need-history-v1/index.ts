import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const REPO = "ionutrosu89-cmyk/Mega-product-radar";
const REF = "refs/heads/main";
const AUD = "mpr-amazon-need-history";
const WORKFLOW_SUFFIX = "/.github/workflows/amazon-need-history-pilot-v1.yml@refs/heads/main";
const ALLOWED_EVENTS = new Set(["push", "schedule", "workflow_dispatch"]);
const jwks = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function rpc(url: string, key: string, name: string, args: unknown) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name}:${r.status}:${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json(401, { error: "GITHUB_OIDC_REQUIRED" });

    const { payload } = await jwtVerify(token, jwks, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: AUD,
    });

    const workflowRef = String(payload.workflow_ref || "");
    const eventName = String(payload.event_name || "");
    if (
      payload.repository !== REPO ||
      payload.ref !== REF ||
      !ALLOWED_EVENTS.has(eventName) ||
      !workflowRef.endsWith(WORKFLOW_SUFFIX)
    ) {
      return json(403, { error: "GITHUB_OIDC_SCOPE_REJECTED" });
    }

    const body = await req.json();
    if (String(body?.expectedSha || "") !== String(payload.sha || "")) {
      return json(403, { error: "HEAD_SHA_MISMATCH" });
    }

    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !key) return json(500, { error: "EDGE_SERVICE_CONFIGURATION_MISSING" });

    if (body?.action === "targets") {
      const limit = Math.max(1, Math.min(25, Number(body?.limit || 25)));
      const targets = await rpc(url, key, "amazon_need_history_targets_v1", { p_limit: limit });
      if (!Array.isArray(targets) || targets.length < 1 || targets.length > 25) {
        return json(409, { error: "TARGET_SCOPE_INVALID", count: Array.isArray(targets) ? targets.length : null });
      }
      if (
        targets.some(
          (x: any) =>
            Number(x.existing_observation_count) > 1 ||
            !/^[A-Z0-9]{10}$/.test(String(x.external_id || ""))
        )
      ) {
        return json(409, { error: "TARGET_CONTENT_INVALID" });
      }
      return json(200, {
        ok: true,
        schema: "MPR_AMAZON_NEED_HISTORY_TARGETS_V1",
        deploymentSha: String(payload.sha),
        targets,
        policy: { providerSpendEur: 0, paidCallsTriggered: 0, purchaseAuthorized: false, verifiedSales: false },
      });
    }

    if (body?.action === "persist") {
      const rows = body?.rows;
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 25) {
        return json(400, { error: "ROWS_SCOPE_INVALID" });
      }
      if (
        rows.some(
          (x: any) =>
            x?.evidenceClass !== "LIVE_PUBLIC_PRODUCT_PAGE" ||
            x?.salesEvidenceClass !== "NOT_VERIFIED_SALES" ||
            x?.purchaseAuthorized !== false
        )
      ) {
        return json(400, { error: "TRUTH_POLICY_INVALID" });
      }

      const receipt = await rpc(url, key, "persist_amazon_live_observations_v1", { p_rows: rows });
      return json(200, {
        ok: true,
        schema: "MPR_AMAZON_NEED_HISTORY_PERSIST_RECEIPT_V1",
        deploymentSha: String(payload.sha),
        receipt,
        policy: { providerSpendEur: 0, paidCallsTriggered: 0, purchaseAuthorized: false, verifiedSales: false },
      });
    }

    return json(400, { error: "ACTION_REJECTED" });
  } catch (e) {
    return json(401, {
      error: "OIDC_OR_REQUEST_REJECTED",
      detail: String((e as any)?.message || e).slice(0, 800),
    });
  }
});
