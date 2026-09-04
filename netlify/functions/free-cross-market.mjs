import {SAAS_CONFIG} from '../../saas-config.js';
import {buildFreeCrossMarketExperience} from '../../free-cross-market-registry.js';
import {loadExpandedTop25Niches} from './free-top25.mjs';
import {enforceRateLimit} from './_security-ops.mjs';
import {ebayBuyAccessState} from './_ebay-buy-auth.mjs';

const headers=service=>({apikey:service,authorization:`Bearer ${service}`,accept:'application/json'});
const present=(env,key)=>Boolean(String(env[key]||'').trim());
const approved=(env,key)=>String(env[key]||'').toLowerCase()==='true';
const access=(env,credentials,terms)=>credentials.some(key=>!present(env,key))?'ACCESS_REQUIRED':!approved(env,terms)?'TERMS_REVIEW_REQUIRED':'READY_TO_COLLECT';
function buildServerAccessState(env){
  return {
    ALIEXPRESS:access(env,['ALIEXPRESS_APP_KEY','ALIEXPRESS_APP_SECRET'],'MPR_ALIEXPRESS_TERMS_APPROVED'),
    EBAY:ebayBuyAccessState(env),
    AMAZON_US:access(env,['AMAZON_PRODUCT_DATA_ACCESS_TOKEN'],'MPR_AMAZON_DATA_RIGHTS_APPROVED'),
    AMAZON_DE:access(env,['AMAZON_PRODUCT_DATA_ACCESS_TOKEN'],'MPR_AMAZON_DATA_RIGHTS_APPROVED'),
    TIKTOK:access(env,['TIKTOK_COMMERCIAL_ACCESS_TOKEN'],'MPR_TIKTOK_COMMERCIAL_TERMS_APPROVED'),
    GOOGLE:access(env,['GOOGLE_MERCHANT_ACCESS_TOKEN'],'MPR_GOOGLE_MARKET_INSIGHTS_TERMS_APPROVED'),
    ROMANIA:approved(env,'MPR_ROMANIA_PUBLIC_EVIDENCE_APPROVED')?'READY_TO_COLLECT':'TERMS_REVIEW_REQUIRED'
  };
}

async function loadCrossMarketSnapshots({fetchImpl,env}){
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!service)return [];
  const url=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
  url.searchParams.set('select','niche_id,reviewed_at,products');
  url.searchParams.set('niche_id','like.XMARKET:*');
  url.searchParams.set('order','reviewed_at.desc');
  url.searchParams.set('limit','500');
  const response=await fetchImpl(url,{headers:headers(service)});
  if(!response.ok)return [];
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
}

export function createFreeCrossMarketHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date()}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-cross-market',limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const [archiveNiches,snapshots]=await Promise.all([
        loadExpandedTop25Niches({env,fetchImpl}).catch(()=>[]),
        loadCrossMarketSnapshots({env,fetchImpl}).catch(()=>[])
      ]);
      const experience=buildFreeCrossMarketExperience({snapshots,archiveNicheCount:archiveNiches.length,accessByPlatform:buildServerAccessState(env),now:now()});
      return Response.json({ok:true,...experience},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {buildServerAccessState,loadCrossMarketSnapshots};
export default createFreeCrossMarketHandler();
export const config={path:'/api/free/cross-market',method:'GET'};
