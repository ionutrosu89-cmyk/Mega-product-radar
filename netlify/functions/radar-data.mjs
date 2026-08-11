import { getStore } from "@netlify/blobs";

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

export function createRadarDataHandler({ getStore: getStoreImpl = getStore, now = () => Date.now() } = {}) {
  return async () => {
    try {
      const store = getStoreImpl("mega-radar-live");
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
