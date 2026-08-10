import { getStore } from "@netlify/blobs";

export function createTriggerHandler({ getStore: getStoreImpl = getStore, fetch: fetchImpl = fetch, env = process.env } = {}) {
  return async (req) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
    if (!env.RADAR_INTERNAL_SECRET) return Response.json({ error: "Scanarea nu este configurată" }, { status: 503 });
    const store = getStoreImpl("mega-radar-live");
    const scan = { status: "queued", requestedAt: new Date().toISOString() };
    await store.set("scan-status", JSON.stringify(scan));
    const baseUrl = env.URL || new URL(req.url).origin;
    const response = await fetchImpl(`${baseUrl}/api/radar/scan`, { method: "POST", headers: { "x-radar-secret": env.RADAR_INTERNAL_SECRET } });
    if (!response.ok && response.status !== 202) {
      const failed = { ...scan, status: "error", error: `Background function HTTP ${response.status}` };
      await store.set("scan-status", JSON.stringify(failed));
      return Response.json({ error: failed.error, scan: failed }, { status: 502 });
    }
    return Response.json({ ok: true, scan }, { status: 202 });
  };
}

export default createTriggerHandler();
export const config = { path: "/api/radar/trigger", method: "POST" };
