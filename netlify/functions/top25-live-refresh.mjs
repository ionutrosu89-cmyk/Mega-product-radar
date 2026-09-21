import {createEbayCrossMarketRefreshHandler} from './ebay-cross-market-refresh.mjs';
import {ebayPublicDisplayAccessState} from './_ebay-buy-auth.mjs';
import {markExpiredCurrentTop25Snapshots} from './_top25-current-store.mjs';

const clean=value=>String(value??'').trim();

export function createTop25LiveRefreshHandler({env=process.env,fetchImpl=fetch,now=()=>new Date(),logger=console}={}){
  return async ()=>{
    const checkedAt=now();
    const access=ebayPublicDisplayAccessState(env);
    const expiry=await markExpiredCurrentTop25Snapshots({env,fetchImpl,cutoff:new Date(checkedAt.getTime()-72*3_600_000)});
    const summary={checkedAt:checkedAt.toISOString(),freshnessMaintenance:expiry.code,providers:[{provider:'EBAY',access,status:'SKIPPED',published:0}],purchaseAuthorized:false};
    if(access==='READY_TO_COLLECT'){
      const secret=clean(env.MPR_INTERNAL_REFRESH_SECRET||env.RADAR_INTERNAL_SECRET);
      if(!secret)summary.providers[0].status='INTERNAL_SECRET_REQUIRED';
      else{
        const handler=createEbayCrossMarketRefreshHandler({env,fetchImpl,now:()=>checkedAt});
        const response=await handler(new Request('https://scheduled.mpr.invalid/api/internal/ebay-cross-market-refresh',{method:'POST',headers:{'x-mpr-internal-secret':secret}}));
        const body=await response.json().catch(()=>({}));
        summary.providers[0]={provider:'EBAY',access,status:String(body?.status||`HTTP_${response.status}`),published:Number(body?.published||0)};
      }
    }
    logger?.info?.('TOP25_LIVE_REFRESH',summary);
    return new Response(null,{status:204});
  };
}

export default createTop25LiveRefreshHandler();
export const config={schedule:'30 5 * * *'};
