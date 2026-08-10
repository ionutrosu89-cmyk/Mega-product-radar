import { getStore } from "@netlify/blobs";

export default async () => {
  try {
    const store = getStore("mega-radar-live");
    const raw = await store.get("latest");
    if (!raw) {
      return Response.json({ ok: true, live: false, products: [], message: "No live scan yet" }, {
        headers: { "Cache-Control": "no-store" }
      });
    }
    const payload = JSON.parse(raw);
    return Response.json({ ok: true, live: true, ...payload }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json({ ok: false, live: false, products: [], error: String(error?.message || error) }, {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
};

export const config = {
  path: "/api/radar/data",
  method: "GET"
};
