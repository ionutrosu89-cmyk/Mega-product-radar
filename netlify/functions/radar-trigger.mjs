import { getStore } from "@netlify/blobs";

function strongStore(getStoreImpl) {
  return getStoreImpl({ name: "mega-radar-live", consistency: "strong" });
}

export function createTriggerHandler({ getStore: getStoreImpl = getStore, fetch: fetchImpl = fetch, env = process.env } = {}) {
  return async (req) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
    }

    if (!env.RADAR_INTERNAL_SECRET) {
      return Response.json({ error: "Scanarea nu este configurată: lipsește RADAR_INTERNAL_SECRET" }, { status: 503 });
    }

    const store = strongStore(getStoreImpl);
    const requestedAt = new Date().toISOString();
    const scanId = crypto.randomUUID();
    const scan = { status: "queued", scanId, requestedAt };
    await store.set("scan-status", JSON.stringify(scan));

    // radar-scan-background has an explicit custom path in its Netlify config.
    // Invoke that deployed route rather than the canonical function-name URL,
    // which can return 404 for functions configured with a custom path.
    const origin = new URL(req.url).origin;
    const backgroundUrl = `${origin}/api/radar/scan?scanId=${encodeURIComponent(scanId)}`;

    let response;
    try {
      response = await fetchImpl(backgroundUrl, {
        method: "POST",
        headers: {
          "x-radar-secret": env.RADAR_INTERNAL_SECRET,
          "content-type": "application/json"
        },
        body: JSON.stringify({ scanId })
      });
    } catch (error) {
      const failed = {
        ...scan,
        status: "error",
        completedAt: new Date().toISOString(),
        error: `Nu am putut porni funcția background: ${String(error?.message || error)}`
      };
      await store.set("scan-status", JSON.stringify(failed));
      return Response.json({ error: failed.error, scan: failed }, { status: 502 });
    }

    if (response.status !== 202) {
      const failed = {
        ...scan,
        status: "error",
        completedAt: new Date().toISOString(),
        error: `Background function HTTP ${response.status}`
      };
      await store.set("scan-status", JSON.stringify(failed));
      return Response.json({ error: failed.error, scan: failed }, { status: 502 });
    }

    return Response.json({ ok: true, scan }, { status: 202 });
  };
}

export default createTriggerHandler();
export const config = { path: "/api/radar/trigger", method: "POST" };
