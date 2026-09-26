import {timingSafeEqual} from 'node:crypto';
import {normalizeCurrentTop25Snapshot} from '../../top25-current-snapshot-v1.js';
import {collectEbayBestSellingTarget,parseEbayTargets} from './_ebay-best-selling.mjs';
import {ebayPublicDisplayAccessState} from './_ebay-buy-auth.mjs';
import {persistCurrentTop25Snapshot} from './_top25-current-store.mjs';

const clean=value=>String(value??'').trim();
const safeEqual=(left,right)=>{
  const a=Buffer.from(clean(left));
  const b=Buffer.from(clean(right));
  return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);
};
const internalSecret=env=>clean(env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET);
export function createEbayCrossMarketRefreshHandler({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
  return async request=>{
    try{
      if(request.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{allow:'POST','Cache-Control':'no-store'}});
      if(!safeEqual(request.headers.get('x-mpr-internal-secret'),internalSecret(env)))return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
      const access=ebayPublicDisplayAccessState(env);
      if(access!=='READY_TO_COLLECT')return Response.json({ok:false,status:access,published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});
      const targets=parseEbayTargets(env);
      if(!targets.length)return Response.json({ok:false,status:'TARGETS_REQUIRED',published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});

      const timestamp=now();
      const results=[];
      for(const target of targets){
        const collected=await collectEbayBestSellingTarget({target,env,fetchImpl,now:()=>timestamp});
        if(!collected.ok){results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:collected.code,published:false});continue;}
        const normalized=normalizeCurrentTop25Snapshot({nicheId:target.nicheId,platform:'EBAY',market:target.marketplaceId,sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',sourceLabel:'eBay Buy Marketing API',products:collected.products},{now:timestamp,rightsApproved:true});
        if(!normalized.ok){results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:normalized.code,published:false});continue;}
        const persisted=await persistCurrentTop25Snapshot({env,fetchImpl,snapshot:normalized.snapshot});
        results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:persisted.code,published:persisted.ok});
      }
      const published=results.filter(row=>row.published).length;
      return Response.json({ok:published>0,status:published>0?'REFRESHED':'NO_PUBLISHABLE_TOP25',published,targets:targets.length,results,policy:{requiredCount:25,noSyntheticRankings:true,purchaseAuthorized:false}},{status:published>0?200:422,headers:{'Cache-Control':'no-store'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error),published:0},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {persistCurrentTop25Snapshot as persistSnapshot,internalSecret};
export default createEbayCrossMarketRefreshHandler();
export const config={path:'/api/internal/ebay-cross-market-refresh',method:'POST'};
