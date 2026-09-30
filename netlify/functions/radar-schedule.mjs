import {getStore} from '@netlify/blobs';
import {paidProviderCallsEnabled} from './_commercial-launch-mode.mjs';
import {claimRadarScan} from './_radar-state.mjs';
export default async (req) => {
  if(!paidProviderCallsEnabled(process.env)||!process.env.RADAR_SCHEDULE_WORKSPACE_ID)return;
  const workspaceId=process.env.RADAR_SCHEDULE_WORKSPACE_ID;
  const secret = process.env.RADAR_INTERNAL_SECRET;
  const baseUrl = process.env.URL || new URL(req.url).origin;
  if (!secret) throw new Error("RADAR_INTERNAL_SECRET is not configured");

  const scanId = crypto.randomUUID();
  const claim=await claimRadarScan(getStore({name:'mega-radar-live',consistency:'strong'}),workspaceId,{scanId,status:'queued',source:'schedule',requestedAt:new Date().toISOString()});
  if(!claim.ok)return;
  const r = await fetch(`${baseUrl}/.netlify/functions/radar-scan-background?scanId=${encodeURIComponent(scanId)}`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      "x-radar-secret": secret,
      "content-type": "application/json"
    },
    body: JSON.stringify({ scanId, workspaceId, source: "schedule" })
  });

  if (r.status !== 202) {
    throw new Error(`Could not trigger background scan: ${r.status}`);
  }
  console.log("Mega Radar background scan triggered");
};

export const config = {
  schedule: "30 4 * * *"
};
