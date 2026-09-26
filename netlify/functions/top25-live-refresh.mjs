import {createAliExpressCrossMarketRefreshHandler} from './aliexpress-cross-market-refresh.mjs';
import {aliexpressPublicDisplayAccessState} from './_aliexpress-hot-products.mjs';
import {createEbayCrossMarketRefreshHandler} from './ebay-cross-market-refresh.mjs';
import {ebayPublicDisplayAccessState} from './_ebay-buy-auth.mjs';
import {markExpiredCurrentTop25Snapshots} from './_top25-current-store.mjs';

const clean=value=>String(value??'').trim();

export function createTop25LiveRefreshHandler({env=process.env,fetchImpl=fetch,now=()=>new Date(),logger=console}={}){
  return async ()=>{
    const checkedAt=now();
    const expiry=await markExpiredCurrentTop25Snapshots({env,fetchImpl,cutoff:new Date(checkedAt.getTime()-72*3_600_000)}).catch(()=>({code:'EXPIRY_MAINTENANCE_FAILED'}));
    const summary={checkedAt:checkedAt.toISOString(),freshnessMaintenance:expiry.code,providers:[],purchaseAuthorized:false};
    for(const [provider,access,createHandler,path] of [
      ['EBAY',ebayPublicDisplayAccessState(env),createEbayCrossMarketRefreshHandler,'ebay-cross-market-refresh'],
      ['ALIEXPRESS',aliexpressPublicDisplayAccessState(env),createAliExpressCrossMarketRefreshHandler,'aliexpress-cross-market-refresh']
    ]){
      const result={provider,access,status:'SKIPPED',published:0};
      summary.providers.push(result);
      if(access!=='READY_TO_COLLECT')continue;
      const secret=clean(env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET);
      if(!secret){result.status='INTERNAL_SECRET_REQUIRED';continue;}
      try{
        const handler=createHandler({env,fetchImpl,now:()=>checkedAt});
        const response=await handler(new Request(`https://scheduled.mpr.invalid/api/internal/${path}`,{method:'POST',headers:{'x-mpr-internal-secret':secret}}));
        const body=await response.json();
        result.status=String(body?.status||`HTTP_${response.status}`);
        result.published=Number(body?.published||0);
      }catch{result.status='REFRESH_FAILED';}
    }
    logger?.info?.('TOP25_LIVE_REFRESH',summary);
    return new Response(null,{status:204});
  };
}

export default createTop25LiveRefreshHandler();
export const config={schedule:'30 5 * * *'};
