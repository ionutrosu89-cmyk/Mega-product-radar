import {timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {keepaCollectionAccessState,parseKeepaTargets,reserveKeepaBudget,collectKeepaCandidates} from './_keepa-top25.mjs';

const clean=value=>String(value??'').trim();
const safeEqual=(a,b)=>{const left=Buffer.from(clean(a)),right=Buffer.from(clean(b));return left.length>0&&left.length===right.length&&timingSafeEqual(left,right);};
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export function createKeepaTop25CollectHandler({env=process.env,fetchImpl=fetch,now=()=>new Date(),storeFactory=()=>getStore({name:'mpr-keepa-private',consistency:'strong'})}={}){
  return async request=>{
    if(!['POST','GET'].includes(request.method))return reply({ok:false,status:'METHOD_NOT_ALLOWED'},405);
    if(!safeEqual(request.headers.get('x-mpr-internal-secret'),env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET))return reply({ok:false,status:'UNAUTHORIZED'},401);
    const timestamp=now(),day=timestamp.toISOString().slice(0,10);
    let payload;
    if(request.method==='POST'){try{payload=await request.json();}catch{return reply({ok:false,status:'INVALID_JSON'},400);}}
    else payload=Object.fromEntries(new URL(request.url).searchParams);
    const targets=parseKeepaTargets(env,timestamp),target=targets.find(row=>row.nicheId===clean(payload?.nicheId).toUpperCase());
    if(!target)return reply({ok:false,status:'APPROVED_TARGET_REQUIRED',providerCalls:0},409);
    try{
      if(request.method==='GET'){
        const requestedDay=clean(payload?.day||day);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(requestedDay))return reply({ok:false,status:'INVALID_DAY'},400);
        const batch=await storeFactory().get(`candidates/${requestedDay}/${target.nicheId}`,{type:'json',consistency:'strong'});
        return batch?reply({ok:true,batch}):reply({ok:false,status:'BATCH_NOT_FOUND'},404);
      }
      const access=keepaCollectionAccessState(env);
      if(access!=='READY_TO_COLLECT')return reply({ok:false,status:access,providerCalls:0},409);
      const store=storeFactory();
      const reservation=await reserveKeepaBudget(store,{day,nicheId:target.nicheId,cap:Number(env.MPR_KEEPA_DAILY_TOKEN_CAP)});
      if(!reservation.ok)return reply({ok:false,status:reservation.code,providerCalls:0},409);
      const collected=await collectKeepaCandidates({target,env,fetchImpl,now:timestamp});
      const receipt={status:collected.code,checkedAt:timestamp.toISOString(),providerCalls:collected.providerCalls,reservedTokens:reservation.reservedTokens,published:0};
      await store.setJSON(`receipts/${day}/${target.nicheId}`,receipt);
      if(!collected.ok)return reply({ok:false,...receipt},422);
      await store.setJSON(`candidates/${day}/${target.nicheId}`,collected.batch);
      return reply({ok:true,...receipt,candidateCount:collected.batch.candidates.length,excludedCount:collected.batch.excluded.length});
    }catch{
      // Neither provider URLs, credentials nor store error details reach clients.
      return reply({ok:false,status:'COLLECTION_OR_STORAGE_FAILED',published:0},503);
    }
  };
}

export default createKeepaTop25CollectHandler();
export const config={path:'/api/internal/keepa-top25-collect'};
