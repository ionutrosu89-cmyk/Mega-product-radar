export default async (req) => {
  const secret = process.env.RADAR_INTERNAL_SECRET;
  const baseUrl = process.env.URL || new URL(req.url).origin;
  if (!secret) throw new Error("RADAR_INTERNAL_SECRET is not configured");

  const r = await fetch(`${baseUrl}/api/radar/scan`, {
    method: "POST",
    headers: { "x-radar-secret": secret }
  });

  if (!r.ok && r.status !== 202) {
    throw new Error(`Could not trigger background scan: ${r.status}`);
  }
  console.log("Mega Radar background scan triggered");
};

export const config = {
  schedule: "30 4 * * *"
};
