import {getStore} from '@netlify/blobs';
import {hasFeature} from '../../billing-plans.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit} from './_security-ops.mjs';

const STALE_SCAN_MS=12*60*1000;
const scanTimestamp=scan=>scan?.startedAt||scan?.requestedAt||null;
function isStale(scan,now=Date.now()){if(!scan||!['queued','running'].includes(scan.status))return false;const t=scanTimestamp(scan),time=Date.parse(t||'');return !t||!Number.isFinite(time)||now-time>STALE_SCAN_MS;}
const strongStore=getStoreImpl=>getStoreImpl({name:'mega-radar-live',consistency:'strong'});
const privateHeaders=()=>({'Cache-Control':'private, no-store','Vary':'Authorization, X-MPR-Workspace-Id'});

export function createRadarDataHandler({getStore:getStoreImpl=getStore,fetch:fetchImpl=fetch,env=process.env,now=()=>Date.now()}={}){
  return async request=>{
    try{
      const access=await resolveWorkspaceAccess(request,{fetchImpl,env});
      if(access.error)return Response.json({ok:false,live:false,products:[],error:access.error,code:access.code,plan:'FREE'},{status:access.status,headers:privateHeaders()});
      if(!hasFeature(access.plan.code,'RADAR'))return Response.json({ok:false,live:false,products:[],error:'Radar plan required',plan:access.plan.code},{status:403,headers:privateHeaders()});
      const rate=await enforceRateLimit(request,{route:'radar-data',workspaceId:access.workspaceId,userId:access.user.id,limit:120,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{...privateHeaders(),'Retry-After':String(rate.retryAfterSeconds)}});
      const store=strongStore(getStoreImpl),raw=await store.get('latest'),scanRaw=await store.get('scan-status');let scan=scanRaw?JSON.parse(scanRaw):{status:'idle'};
      if(isStale(scan,now())){scan={...scan,status:'error',completedAt:new Date(now()).toISOString(),error:'Scanarea anterioară a expirat. Poți porni din nou Run Scan.'};await store.set('scan-status',JSON.stringify(scan));}
      if(!raw)return Response.json({ok:true,live:false,products:[],scan,plan:access.plan.code,workspaceId:access.workspaceId,message:'No live scan yet'},{headers:privateHeaders()});
      return Response.json({ok:true,live:true,scan,plan:access.plan.code,workspaceId:access.workspaceId,...JSON.parse(raw)},{headers:privateHeaders()});
    }catch(error){return Response.json({ok:false,live:false,products:[],error:String(error?.message||error)},{status:500,headers:privateHeaders()});}
  };
}
export default createRadarDataHandler();
export const config={path:'/api/radar/data',method:'GET'};
