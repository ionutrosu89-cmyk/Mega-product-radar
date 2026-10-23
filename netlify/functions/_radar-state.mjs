// One conditional state document per workspace fences concurrent and expired workers.
export const SCAN_LEASE_MS=20*60*1000;
export function radarStateKey(workspaceId){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(String(workspaceId||'')))throw new Error('WORKSPACE_CONTEXT_REQUIRED');
  return `workspaces/${workspaceId}/state`;
}
export async function readRadarState(store,workspaceId){
  const entry=await store.getWithMetadata(radarStateKey(workspaceId),{type:'json',consistency:'strong'});
  if(entry&&!entry.etag)throw new Error('RADAR_ATOMIC_STATE_UNAVAILABLE');
  return entry;
}
export async function claimRadarScan(store,workspaceId,scan,now=Date.now()){
  const entry=await readRadarState(store,workspaceId),old=entry?.data?.scan;
  if(['queued','running'].includes(old?.status)&&Date.parse(old.leaseExpiresAt)>now)return {ok:false,scan:old};
  const next={...(entry?.data||{}),workspaceId,scan:{...scan,workspaceId,leaseExpiresAt:new Date(now+SCAN_LEASE_MS).toISOString()}};
  const result=await store.setJSON(radarStateKey(workspaceId),next,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
  return {ok:result.modified===true,scan:next.scan};
}
export async function transitionRadarScan(store,workspaceId,scanId,changes,payload,now=Date.now()){
  const entry=await readRadarState(store,workspaceId),scan=entry?.data?.scan;
  if(scan?.scanId!==scanId||!['queued','running'].includes(scan?.status)||!(Date.parse(scan.leaseExpiresAt)>now))return false;
  // Background redelivery must not execute the provider twice.
  if(changes.status==='running'&&scan.status!=='queued')return false;
  const next={...entry.data,scan:{...scan,...changes},...(payload?{latest:{...payload,workspaceId,scanId}}:{})};
  const result=await store.setJSON(radarStateKey(workspaceId),next,{onlyIfMatch:entry.etag});
  return result.modified===true;
}
