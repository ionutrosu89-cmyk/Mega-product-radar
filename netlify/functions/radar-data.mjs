import { getStore } from "@netlify/blobs";

export function createRadarDataHandler({ getStore: getStoreImpl = getStore } = {}) {
  return async () => {
    try {
      const store = getStoreImpl("mega-radar-live");
      const raw = await store.get("latest");
      const scanRaw = await store.get("scan-status");
      const scan = scanRaw ? JSON.parse(scanRaw) : { status: "idle" };
      if (!raw) {
        return Response.json({ ok: true, live: false, products: [], scan, message: "No live scan yet" }, {
          headers: { "Cache-Control": "no-store" }
        });
      }
      const payload = JSON.parse(raw);
      return Response.json({ ok: true, live: true, scan, ...payload }, {
        headers: { "Cache-Control": "no-store" }
      });
    } catch (error) {
      return Response.json({ ok: false, live: false, products: [], error: String(error?.message || error) }, {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      });
    }
  };
}

export default createRadarDataHandler();

export const config = {
  path: "/api/radar/data",
  method: "GET"
};
