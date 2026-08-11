import { getStore } from "@netlify/blobs";

export default async () => {
  const checks = {
    openaiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    radarSecretConfigured: Boolean(process.env.RADAR_INTERNAL_SECRET),
    blobReadWrite: false
  };

  let blobError = null;
  try {
    const store = getStore({ name: "mega-radar-live", consistency: "strong" });
    const key = `health/${Date.now()}`;
    const value = JSON.stringify({ ok: true, at: new Date().toISOString() });
    await store.set(key, value);
    checks.blobReadWrite = (await store.get(key)) === value;
    await store.delete(key);
  } catch (error) {
    blobError = String(error?.message || error);
  }

  const ok = checks.openaiKeyConfigured && checks.radarSecretConfigured && checks.blobReadWrite;

  return Response.json({
    ok,
    checks,
    blobError,
    now: new Date().toISOString()
  }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
};

export const config = {
  path: "/api/radar/health",
  method: "GET"
};
