import {timingSafeEqual} from 'node:crypto';
import {SAAS_CONFIG} from '../../saas-config.js';
import {collectEbayBestSellingTarget,parseEbayTargets} from './_ebay-best-selling.mjs';
import {ebayBuyAccessState} from './_ebay-buy-auth.mjs';

const clean=value=>String(value??'').trim();
const safeEqual=(left,right)=>{
  const a=Buffer.from(clean(left));
  const b=Buffer.from(clean(right));
  return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);
};
const serviceHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'});

async function persistSnapshot({env,fetchImpl,nicheId,reviewedAt,products}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
  const service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED'};
  const url=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
  url.searchParams.set('on_conflict','niche_id,reviewed_at');
  const response=await fetchImpl(url,{method:'POST',headers:serviceHeaders(service),body:JSON.stringify([{niche_id:nicheId,reviewed_at:reviewedAt,products}])});
  return response.ok?{ok:true,code:'PERSISTED'}:{ok:false,code:`SUPABASE_HTTP_${response.status}`};
}

export function createEbayCrossMarketRefreshHandler({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
  return async request=>{
    try{
      if(request.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{allow:'POST','Cache-Control':'no-store'}});
      if(!safeEqual(request.headers.get('x-mpr-internal-secret'),env.MPR_INTERNAL_REFRESH_SECRET))return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
      const access=ebayBuyAccessState(env);
      if(access!=='READY_TO_COLLECT')return Response.json({ok:false,status:access,published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});
      const targets=parseEbayTargets(env);
      if(!targets.length)return Response.json({ok:false,status:'TARGETS_REQUIRED',published:0,providerCalls:0},{status:409,headers:{'Cache-Control':'no-store'}});

      const timestamp=now();
      const reviewedAt=timestamp.toISOString().slice(0,10);
      const results=[];
      for(const target of targets){
        const collected=await collectEbayBestSellingTarget({target,env,fetchImpl,now:()=>timestamp});
        if(!collected.ok){results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:collected.code,published:false});continue;}
        const nicheId=`XMARKET:EBAY:${target.nicheId}`;
        const persisted=await persistSnapshot({env,fetchImpl,nicheId,reviewedAt,products:collected.products});
        results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:persisted.code,published:persisted.ok});
      }
      const published=results.filter(row=>row.published).length;
      return Response.json({ok:published>0,status:published>0?'REFRESHED':'NO_PUBLISHABLE_TOP25',published,targets:targets.length,results,policy:{requiredCount:25,noSyntheticRankings:true,purchaseAuthorized:false}},{status:published>0?200:422,headers:{'Cache-Control':'no-store'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error),published:0},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {persistSnapshot};
export default createEbayCrossMarketRefreshHandler();
export const config={path:'/api/internal/ebay-cross-market-refresh',method:'POST'};
