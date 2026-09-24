import {buildFreeCrossMarketExperience} from '../../free-cross-market-registry.js';
import {enforceRateLimit,requestId} from './_security-ops.mjs';
import {ebayBuyAccessState} from './_ebay-buy-auth.mjs';

const present=(env,key)=>Boolean(String(env[key]||'').trim());
const approved=(env,key)=>String(env[key]||'').toLowerCase()==='true';
const access=(env,credentials,terms,display)=>credentials.some(key=>!present(env,key))?'ACCESS_REQUIRED':!approved(env,terms)?'TERMS_REVIEW_REQUIRED':!approved(env,display)?'PUBLIC_DISPLAY_RIGHTS_REQUIRED':'READY_TO_COLLECT';
function buildServerAccessState(env){
  return {
    ALIEXPRESS:access(env,['ALIEXPRESS_APP_KEY','ALIEXPRESS_APP_SECRET'],'MPR_ALIEXPRESS_TERMS_APPROVED','MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED'),
    EBAY:ebayBuyAccessState(env)==='READY_TO_COLLECT'?(approved(env,'MPR_EBAY_PUBLIC_DISPLAY_APPROVED')?'READY_TO_COLLECT':'PUBLIC_DISPLAY_RIGHTS_REQUIRED'):ebayBuyAccessState(env),
    AMAZON_US:access(env,['AMAZON_PRODUCT_DATA_ACCESS_TOKEN'],'MPR_AMAZON_DATA_RIGHTS_APPROVED','MPR_AMAZON_PUBLIC_DISPLAY_APPROVED'),
    AMAZON_DE:access(env,['AMAZON_PRODUCT_DATA_ACCESS_TOKEN'],'MPR_AMAZON_DATA_RIGHTS_APPROVED','MPR_AMAZON_PUBLIC_DISPLAY_APPROVED'),
    TIKTOK:'SUPPORTING_SIGNAL_ONLY',
    GOOGLE:'SUPPORTING_SIGNAL_ONLY',
    ROMANIA:'SUPPORTING_SIGNAL_ONLY'
  };
}

export function createFreeCrossMarketHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date(),logger=console}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-cross-market',limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      // Keep public rankings empty until the reviewed live-source pipeline is released.
      const experience=buildFreeCrossMarketExperience({snapshots:[],accessByPlatform:buildServerAccessState(env),now:now()});
      return Response.json({ok:true,...experience},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){
      const incidentId=requestId(request);
      logger?.error?.('FREE_CROSS_MARKET_INTERNAL_ERROR',{incidentId,errorName:String(error?.name||'Error'),errorMessage:String(error?.message||'unknown').slice(0,300)});
      return Response.json({ok:false,error:'Internal server error',incidentId},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {buildServerAccessState};
export default createFreeCrossMarketHandler();
export const config={path:'/api/free/cross-market',method:'GET'};
