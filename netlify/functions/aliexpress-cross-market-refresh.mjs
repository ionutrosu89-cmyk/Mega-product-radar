import {timingSafeEqual} from 'node:crypto';
import {normalizeCurrentTop25Snapshot} from '../../top25-current-snapshot-v1.js';
import {aliexpressPublicDisplayAccessState,collectAliExpressHotProductsTarget,parseAliExpressTargets} from './_aliexpress-hot-products.mjs';
import {dueCurrentTop25Targets,persistCurrentTop25Snapshot} from './_top25-current-store.mjs';

const clean=value=>String(value??'').trim();
const safeEqual=(left,right)=>{const a=Buffer.from(clean(left)),b=Buffer.from(clean(right));return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);};
const internalSecret=env=>clean(env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET);

export function createAliExpressCrossMarketRefreshHandler({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
  return async request=>{
    try{
      if(request.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{allow:'POST','Cache-Control':'no-store'}});
      if(!safeEqual(request.headers.get('x-mpr-internal-secret'),internalSecret(env)))return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
      let input;
      try{input=JSON.parse(await request.text()||'{}');}catch{return Response.json({ok:false,status:'INVALID_REQUEST_JSON',providerCalls:0},{status:400,headers:{'Cache-Control':'no-store'}});}
      if(!input||typeof input!=='object'||Array.isArray(input)||input.mode!==undefined&&!['PUBLISH','PUBLISH_DUE'].includes(input.mode))return Response.json({ok:false,status:'UNSUPPORTED_MODE',providerCalls:0},{status:400,headers:{'Cache-Control':'no-store'}});
      const access=aliexpressPublicDisplayAccessState(env);
      if(access!=='READY_TO_COLLECT')return Response.json({ok:false,status:access,published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});
      const targets=parseAliExpressTargets(env);
      if(!targets.length)return Response.json({ok:false,status:'TARGETS_REQUIRED',published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});
      const timestamp=now(),results=[];
      let selectedTargets=targets;
      if(input.mode==='PUBLISH_DUE'){
        const due=await dueCurrentTop25Targets({env,fetchImpl,platform:'ALIEXPRESS',targets,now:timestamp});
        if(!due.ok)return Response.json({ok:false,status:due.code,published:0,providerCalls:0},{status:503,headers:{'Cache-Control':'no-store'}});
        selectedTargets=due.dueTargets;
        if(!selectedTargets.length)return Response.json({ok:true,status:'NOT_DUE',published:0,providerCalls:0,targets:targets.length},{headers:{'Cache-Control':'no-store'}});
      }
      for(const target of selectedTargets){
        try{
          const collected=await collectAliExpressHotProductsTarget({target,env,fetchImpl,now:()=>timestamp});
          if(!collected.ok){results.push({nicheId:target.nicheId,status:collected.code,published:false});continue;}
          const normalized=normalizeCurrentTop25Snapshot({nicheId:target.nicheId,platform:'ALIEXPRESS',market:'ALIEXPRESS_GLOBAL',sourceKey:'ALIEXPRESS_HOT_PRODUCTS_API',sourceLabel:'AliExpress Open Platform',products:collected.products},{now:timestamp,rightsApproved:true});
          if(!normalized.ok){results.push({nicheId:target.nicheId,status:normalized.code,published:false});continue;}
          const persisted=await persistCurrentTop25Snapshot({env,fetchImpl,snapshot:normalized.snapshot});
          results.push({nicheId:target.nicheId,status:persisted.code,published:persisted.ok});
        }catch{results.push({nicheId:target.nicheId,status:'ALIEXPRESS_COLLECTION_FAILED',published:false});}
      }
      const published=results.filter(row=>row.published).length;
      return Response.json({ok:published>0,status:published>0?'REFRESHED':'NO_PUBLISHABLE_TOP25',published,targets:selectedTargets.length,results,policy:{requiredCount:25,noSyntheticRankings:true,purchaseAuthorized:false}},{status:published>0?200:422,headers:{'Cache-Control':'no-store'}});
    }catch{return Response.json({ok:false,error:'Internal server error',published:0},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export {internalSecret};
export default createAliExpressCrossMarketRefreshHandler();
export const config={path:'/api/internal/aliexpress-cross-market-refresh',method:'POST'};
