import {SAAS_CONFIG} from '../../saas-config.js';
import {buildFreeCrossMarketExperience} from '../../free-cross-market-registry.js';
import {enforceRateLimit,requestId} from './_security-ops.mjs';
import {ebayPublicDisplayAccessState} from './_ebay-buy-auth.mjs';

const headers=service=>({apikey:service,authorization:`Bearer ${service}`,accept:'application/json'});
const present=(env,key)=>Boolean(String(env[key]||'').trim());
const approved=(env,key)=>String(env[key]||'').toLowerCase()==='true';
const access=(env,credentials,terms,publicDisplay)=>credentials.some(key=>!present(env,key))?'ACCESS_REQUIRED':!approved(env,terms)?'TERMS_REVIEW_REQUIRED':publicDisplay&&!approved(env,publicDisplay)?'PUBLIC_DISPLAY_RIGHTS_REQUIRED':'READY_TO_COLLECT';
function buildServerAccessState(env){
  return {
    ALIEXPRESS:access(env,['ALIEXPRESS_APP_KEY','ALIEXPRESS_APP_SECRET','ALIEXPRESS_TRACKING_ID'],'MPR_ALIEXPRESS_TERMS_APPROVED','MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED'),
    EBAY:ebayPublicDisplayAccessState(env),
    AMAZON_US:access(env,['KEEPA_API_KEY'],'MPR_KEEPA_TERMS_APPROVED','MPR_KEEPA_PUBLIC_DISPLAY_APPROVED'),
    AMAZON_DE:access(env,['KEEPA_API_KEY'],'MPR_KEEPA_TERMS_APPROVED','MPR_KEEPA_PUBLIC_DISPLAY_APPROVED'),
    TIKTOK:'SUPPORTING_SIGNAL_ONLY',
    GOOGLE:'SUPPORTING_SIGNAL_ONLY',
    ROMANIA:'SUPPORTING_SIGNAL_ONLY'
  };
}

async function loadCrossMarketSnapshots({fetchImpl,env}){
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!service)return [];
  const url=new URL(`${supabaseUrl}/rest/v1/current_top25_snapshots_v1`);
  url.searchParams.set('select','niche_id,platform,market,window_end,products,product_count,evidence_class,source_key,source_label,source_rights_status,freshness_status');
  url.searchParams.set('product_count','eq.25');
  url.searchParams.set('source_rights_status','eq.APPROVED');
  url.searchParams.set('freshness_status','eq.CURRENT');
  url.searchParams.set('order','window_end.desc');
  url.searchParams.set('limit','2000');
  const response=await fetchImpl(url,{headers:headers(service)});
  if(!response.ok)return [];
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
}

export function createFreeCrossMarketHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date(),logger=console}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-cross-market',limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const snapshots=await loadCrossMarketSnapshots({env,fetchImpl}).catch(()=>[]);
      const experience=buildFreeCrossMarketExperience({snapshots,accessByPlatform:buildServerAccessState(env),now:now()});
      return Response.json({ok:true,...experience},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){
      const incidentId=requestId(request);
      logger?.error?.('FREE_CROSS_MARKET_INTERNAL_ERROR',{incidentId,errorName:String(error?.name||'Error'),errorMessage:String(error?.message||'unknown').slice(0,300)});
      return Response.json({ok:false,error:'Internal server error',incidentId},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {buildServerAccessState,loadCrossMarketSnapshots};
export default createFreeCrossMarketHandler();
export const config={path:'/api/free/cross-market',method:'GET'};
