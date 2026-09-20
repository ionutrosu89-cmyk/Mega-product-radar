import {timingSafeEqual} from 'node:crypto';
import {normalizeCurrentTop25Snapshot,publicDisplayApprovalKey} from '../../top25-current-snapshot-v1.js';
import {persistCurrentTop25Snapshot} from './_top25-current-store.mjs';

const clean=value=>String(value??'').trim();
const approved=(env,key)=>clean(env[key]).toLowerCase()==='true';
const safeEqual=(left,right)=>{const a=Buffer.from(clean(left)),b=Buffer.from(clean(right));return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);};
const internalSecret=env=>clean(env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET);

export function createTop25LiveIngestHandler({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
  return async request=>{
    if(request.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{allow:'POST','Cache-Control':'no-store'}});
    if(!safeEqual(request.headers.get('x-mpr-internal-secret'),internalSecret(env)))return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
    let payload;try{payload=await request.json();}catch{return Response.json({ok:false,error:'Invalid JSON'},{status:400,headers:{'Cache-Control':'no-store'}});}
    const submitted=Array.isArray(payload?.snapshots)?payload.snapshots.slice(0,25):[];
    if(!submitted.length)return Response.json({ok:false,error:'snapshots are required'},{status:400,headers:{'Cache-Control':'no-store'}});
    const results=[];
    for(const raw of submitted){
      const platform=clean(raw?.platform).toUpperCase(),rightsKey=publicDisplayApprovalKey(platform);
      const normalized=normalizeCurrentTop25Snapshot(raw,{now:now(),rightsApproved:approved(env,rightsKey)});
      if(!normalized.ok){results.push({nicheId:clean(raw?.nicheId||raw?.niche_id).toUpperCase(),platform,status:normalized.code,published:false});continue;}
      const persisted=await persistCurrentTop25Snapshot({env,fetchImpl,snapshot:normalized.snapshot});
      results.push({nicheId:normalized.snapshot.niche_id,platform,status:persisted.code,published:persisted.ok});
    }
    const published=results.filter(row=>row.published).length;
    return Response.json({ok:published>0,status:published>0?'INGESTED':'NO_PUBLISHABLE_TOP25',published,submitted:submitted.length,results,policy:{exactly25Required:true,freshnessRequired:true,publicDisplayRightsRequired:true,noUnitSalesClaims:true,purchaseAuthorized:false}},{status:published>0?200:422,headers:{'Cache-Control':'no-store'}});
  };
}

export {internalSecret};
export default createTop25LiveIngestHandler();
export const config={path:'/api/internal/top25-live-ingest',method:'POST'};
