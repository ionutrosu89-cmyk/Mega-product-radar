import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import test from "node:test";

test("only the canonical Netlify Functions are present", async () => {
  const entries = (await readdir("netlify/functions", { recursive: true })).filter((entry) => entry.endsWith(".mjs")).sort();
  assert.deepEqual(entries, ["billing-checkout.mjs","billing-webhook.mjs","commercial-discover.mjs","radar-data.mjs","radar-health.mjs","radar-scan-background.mjs","radar-schedule.mjs","radar-sync.mjs","radar-trigger.mjs"]);
});

test("radar-data exposes live data and scan state from blobs", async () => {
  const { createRadarDataHandler } = await import("../netlify/functions/radar-data.mjs");
  const values = new Map([["latest", JSON.stringify({ updatedAt: "2026-08-10T00:00:00Z", products: [{ name: "Live" }] })],["scan-status", JSON.stringify({ status: "completed" })]]);
  const response = await createRadarDataHandler({ getStore: () => ({ get: key => values.get(key) }) })();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, live: true, scan: { status: "completed" }, updatedAt: "2026-08-10T00:00:00Z", products: [{ name: "Live" }] });
});

test("public trigger queues the protected background route without exposing its secret", async () => {
  const { createTriggerHandler } = await import("../netlify/functions/radar-trigger.mjs");
  const writes = new Map(); let outbound;
  const handler = createTriggerHandler({ env: { RADAR_INTERNAL_SECRET: "server-only" }, getStore: () => ({ set: (key,value) => writes.set(key,value) }), fetch: async (url, options) => { outbound={url,options}; return new Response(null,{status:202}); } });
  const response = await handler(new Request("https://radar.example/api/radar/trigger", { method: "POST" }));
  assert.equal(response.status, 202);
  assert.match(outbound.url, /^https:\/\/radar\.example\/api\/radar\/scan\?scanId=/);
  assert.equal(outbound.options.headers["x-radar-secret"], "server-only");
  assert.equal(JSON.parse(writes.get("scan-status")).status, "queued");
  assert.equal(JSON.stringify(await response.json()).includes("server-only"), false);
});

test("background scan rejects missing server secret before calling paid services", async () => {
  const previous = process.env.RADAR_INTERNAL_SECRET; delete process.env.RADAR_INTERNAL_SECRET;
  try { const { default: scan } = await import("../netlify/functions/radar-scan-background.mjs"); const response = await scan(new Request("https://radar.example/api/radar/scan", { method: "POST" })); assert.equal(response.status, 403); }
  finally { if (previous === undefined) delete process.env.RADAR_INTERNAL_SECRET; else process.env.RADAR_INTERNAL_SECRET = previous; }
});

test("cloud sync is disabled without server secret and rejects wrong secret", async () => {
  const { createRadarSyncHandler } = await import("../netlify/functions/radar-sync.mjs");
  let touched=false;
  const disabled=createRadarSyncHandler({env:{},getStore:()=>{touched=true;return{};}});
  const noSecret=await disabled(new Request("https://radar.example/api/radar/sync"));
  assert.equal(noSecret.status,503);assert.equal(touched,false);
  const protectedHandler=createRadarSyncHandler({env:{RADAR_SYNC_SECRET:'correct'},getStore:()=>{touched=true;return{};}});
  const wrong=await protectedHandler(new Request("https://radar.example/api/radar/sync",{headers:{'x-radar-sync-secret':'wrong'}}));
  assert.equal(wrong.status,401);assert.equal(touched,false);
});

test("frontend normalization and economics handle untrusted malformed live fields", async () => {
  const { economics, isBuyZone, normalizeProducts } = await import("../app.js");
  const [product] = normalizeProducts([{ name: "<img onerror=alert(1)>", cat: null, landed: "50", sell: "200", score: "90", sourcing: "bad" }]);
  assert.equal(product.name, "<img onerror=alert(1)>"); assert.deepEqual(product.sourcing, []); assert.ok(economics(product).profit > 0); assert.equal(isBuyZone(product), true);
});

test("root-level duplicate functions are absent", async () => { for (const file of ["radar-data.mjs", "radar-scan-background.mjs", "radar-schedule.mjs"]) await assert.rejects(access(file, constants.F_OK)); });

test("products.json has the frontend's required shape", async () => {
  const products = JSON.parse(await readFile("products.json", "utf8")); const required = ["name", "cat", "chinaMin", "chinaMax", "landed", "sell", "gap", "score", "markets"];
  assert.ok(Array.isArray(products)); assert.ok(products.length > 0);
  for (const product of products) { assert.deepEqual(required.filter((field) => !(field in product)), []); for (const field of ["chinaMin", "chinaMax", "landed", "sell", "gap", "score"]) assert.equal(Number.isFinite(product[field]), true, `${product.name}: ${field}`); }
});