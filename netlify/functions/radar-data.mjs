import {getStore} from '@netlify/blobs';
import {hasFeature} from '../../billing-plans.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit} from './_security-ops.mjs';
import {readRadarState} from './_radar-state.mjs';

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
      const state=(await readRadarState(strongStore(getStoreImpl),access.workspaceId))?.data;
      const raw=state?.latest;let scan=state?.scan||{status:'idle'};
      if(['queued','running'].includes(scan.status)&&!(Date.parse(scan.leaseExpiresAt)>now()))scan={...scan,status:'expired'};
      if(!raw)return Response.json({ok:true,live:false,products:[],scan,plan:access.plan.code,workspaceId:access.workspaceId,message:'No live scan yet'},{headers:privateHeaders()});
      if(raw.workspaceId!==access.workspaceId||!Array.isArray(raw.products))throw new Error('INVALID_RADAR_PAYLOAD');
      return Response.json({...raw,ok:true,live:true,scan,plan:access.plan.code,workspaceId:access.workspaceId},{headers:privateHeaders()});
    }catch(error){return Response.json({ok:false,live:false,products:[],code:'RADAR_DATA_UNAVAILABLE',error:'Datele radar nu sunt disponibile.'},{status:500,headers:privateHeaders()});}
  };
}
export default createRadarDataHandler();
export const config={path:'/api/radar/data',method:'GET'};
