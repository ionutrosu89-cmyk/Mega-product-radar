import {getStore} from '@netlify/blobs';
import {hasFeature} from '../../billing-plans.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit,recordSecurityAudit} from './_security-ops.mjs';
import {freeBetaProviderResponse,paidProviderCallsEnabled} from './_commercial-launch-mode.mjs';

const strongStore=getStoreImpl=>getStoreImpl({name:'mega-radar-live',consistency:'strong'});

export function createTriggerHandler({getStore:getStoreImpl=getStore,fetch:fetchImpl=fetch,env=process.env}={}){
  return async req=>{
    if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:'POST'}});
    if(!paidProviderCallsEnabled(env))return freeBetaProviderResponse();
    const access=await resolveWorkspaceAccess(req,{fetchImpl,env,allowedRoles:['OWNER','ADMIN']});
    if(access.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization, X-MPR-Workspace-Id'}});
    if(!hasFeature(access.plan.code,'RADAR'))return Response.json({ok:false,error:'Radar plan required'},{status:403});
    const rate=await enforceRateLimit(req,{route:'radar-trigger',workspaceId:access.workspaceId,userId:access.user.id,limit:6,windowSeconds:300,env,fetchImpl});
    if(!rate.ok)return Response.json({ok:false,error:'Too many scan requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds)}});
    if(!env.RADAR_INTERNAL_SECRET)return Response.json({error:'Scanarea nu este configurată: lipsește RADAR_INTERNAL_SECRET'},{status:503});

    const store=strongStore(getStoreImpl),requestedAt=new Date().toISOString(),scanId=crypto.randomUUID();
    const scan={status:'queued',scanId,requestedAt,workspaceId:access.workspaceId,requestedBy:access.user.id};
    await store.set('scan-status',JSON.stringify(scan));
    await recordSecurityAudit({request:req,eventType:'RADAR_SCAN_REQUESTED',workspaceId:access.workspaceId,userId:access.user.id,actorRole:access.membership.role,metadata:{scanId}},{env,fetchImpl});

    const origin=new URL(req.url).origin,backgroundUrl=`${origin}/api/radar/scan?scanId=${encodeURIComponent(scanId)}`;
    let response;
    try{response=await fetchImpl(backgroundUrl,{method:'POST',headers:{'x-radar-secret':env.RADAR_INTERNAL_SECRET,'content-type':'application/json'},body:JSON.stringify({scanId,workspaceId:access.workspaceId})});}
    catch(error){const failed={...scan,status:'error',completedAt:new Date().toISOString(),error:`Nu am putut porni funcția background: ${String(error?.message||error)}`};await store.set('scan-status',JSON.stringify(failed));return Response.json({error:failed.error,scan:failed},{status:502});}
    if(response.status!==202){const failed={...scan,status:'error',completedAt:new Date().toISOString(),error:`Background function HTTP ${response.status}`};await store.set('scan-status',JSON.stringify(failed));return Response.json({error:failed.error,scan:failed},{status:502});}
    return Response.json({ok:true,scan},{status:202,headers:{'Cache-Control':'private, no-store'}});
  };
}
export default createTriggerHandler();
export const config={path:'/api/radar/trigger',method:'POST'};
