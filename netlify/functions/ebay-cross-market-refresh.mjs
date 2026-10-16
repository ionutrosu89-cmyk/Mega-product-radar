import {timingSafeEqual} from 'node:crypto';
import {normalizeCurrentTop25Snapshot} from '../../top25-current-snapshot-v1.js';
import {collectEbayBestSellingTarget,parseEbayTargets} from './_ebay-best-selling.mjs';
import {ebayBuyAccessState,ebayPublicDisplayAccessState} from './_ebay-buy-auth.mjs';
import {dueCurrentTop25Targets,persistCurrentTop25Snapshot} from './_top25-current-store.mjs';

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
      let input;
      try{input=JSON.parse(await request.text()||'{}');}catch{return Response.json({ok:false,status:'INVALID_REQUEST_JSON'},{status:400,headers:{'Cache-Control':'no-store'}});}
      if(!input||typeof input!=='object'||Array.isArray(input))return Response.json({ok:false,status:'INVALID_REQUEST_BODY'},{status:400,headers:{'Cache-Control':'no-store'}});
      if(input.mode==='REVIEW_CANDIDATES'){
        const access=ebayBuyAccessState(env);
        if(access!=='READY_TO_COLLECT')return Response.json({ok:false,status:access,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});
        const nicheId=clean(input.nicheId).toUpperCase(),marketplaceId=clean(input.marketplaceId).toUpperCase();
        const target=parseEbayTargets(env,now()).find(row=>row.nicheId===nicheId&&row.marketplaceId===marketplaceId);
        if(!target)return Response.json({ok:false,status:'REVIEW_TARGET_NOT_CONFIGURED',providerCalls:0},{status:400,headers:{'Cache-Control':'no-store'}});
        const collected=await collectEbayBestSellingTarget({target,env,fetchImpl,now,reviewPool:true});
        return Response.json({ok:collected.candidates.length>0,status:collected.code,nicheId,marketplaceId,candidateCount:collected.candidates.length,candidates:collected.candidates,policy:{internalReviewOnly:true,published:0,autoApproved:0,purchaseAuthorized:false}},{status:collected.candidates.length>0?200:422,headers:{'Cache-Control':'no-store'}});
      }
      if(input.mode!==undefined&&!['PUBLISH','PUBLISH_DUE'].includes(input.mode))return Response.json({ok:false,status:'UNSUPPORTED_MODE',providerCalls:0},{status:400,headers:{'Cache-Control':'no-store'}});
      const access=ebayPublicDisplayAccessState(env);
      if(access!=='READY_TO_COLLECT')return Response.json({ok:false,status:access,published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});
      const targets=parseEbayTargets(env,now());
      if(!targets.length)return Response.json({ok:false,status:'TARGETS_REQUIRED',published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});

      const timestamp=now();
      let selectedTargets=targets;
      if(input.mode==='PUBLISH_DUE'){
        const due=await dueCurrentTop25Targets({env,fetchImpl,platform:'EBAY',targets,now:timestamp});
        if(!due.ok)return Response.json({ok:false,status:due.code,published:0,providerCalls:0},{status:503,headers:{'Cache-Control':'no-store'}});
        selectedTargets=due.dueTargets;
        if(!selectedTargets.length)return Response.json({ok:true,status:'NOT_DUE',published:0,providerCalls:0,targets:targets.length},{headers:{'Cache-Control':'no-store'}});
      }
      const results=[];
      for(const target of selectedTargets){
        const collected=await collectEbayBestSellingTarget({target,env,fetchImpl,now:()=>timestamp});
        if(!collected.ok){results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:collected.code,published:false});continue;}
        const normalized=normalizeCurrentTop25Snapshot({nicheId:target.nicheId,platform:'EBAY',market:target.marketplaceId,sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',sourceLabel:'eBay Buy Marketing API',products:collected.products},{now:timestamp,rightsApproved:true});
        if(!normalized.ok){results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:normalized.code,published:false});continue;}
        const persisted=await persistCurrentTop25Snapshot({env,fetchImpl,snapshot:normalized.snapshot});
        results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:persisted.code,published:persisted.ok});
      }
      const published=results.filter(row=>row.published).length;
      return Response.json({ok:published>0,status:published>0?'REFRESHED':'NO_PUBLISHABLE_TOP25',published,targets:selectedTargets.length,results,policy:{requiredCount:25,noSyntheticRankings:true,purchaseAuthorized:false}},{status:published>0?200:422,headers:{'Cache-Control':'no-store'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error),published:0},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {persistCurrentTop25Snapshot as persistSnapshot,internalSecret};
export default createEbayCrossMarketRefreshHandler();
export const config={path:'/api/internal/ebay-cross-market-refresh',method:'POST'};
