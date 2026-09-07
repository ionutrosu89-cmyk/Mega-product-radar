import {timingSafeEqual} from 'node:crypto';
import {SAAS_CONFIG} from '../../saas-config.js';
import {buildCurrentTop25Window} from '../../current-top25-window-engine-v1.js';
import {collectEbayBestSellingTarget,parseEbayTargets} from './_ebay-best-selling.mjs';
import {ebayBuyAccessState} from './_ebay-buy-auth.mjs';

const clean=value=>String(value??'').trim();
const safeEqual=(left,right)=>{
  const a=Buffer.from(clean(left));
  const b=Buffer.from(clean(right));
  return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);
};
const serviceHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'});
const readHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,accept:'application/json'});

async function persistSnapshot({env,fetchImpl,nicheId,reviewedAt,products}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
  const service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED'};
  const url=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
  url.searchParams.set('on_conflict','niche_id,reviewed_at');
  const response=await fetchImpl(url,{method:'POST',headers:serviceHeaders(service),body:JSON.stringify([{niche_id:nicheId,reviewed_at:reviewedAt,products}])});
  return response.ok?{ok:true,code:'PERSISTED'}:{ok:false,code:`SUPABASE_HTTP_${response.status}`};
}

async function loadRecentDailySnapshots({env,fetchImpl,nicheId,windowEnd}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
  const service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return [];
  const cutoff=new Date(new Date(windowEnd).getTime()-31*86400000).toISOString().slice(0,10);
  const url=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
  url.searchParams.set('select','reviewed_at,products');
  url.searchParams.set('niche_id',`eq.${nicheId}`);
  url.searchParams.set('reviewed_at',`gte.${cutoff}`);
  url.searchParams.set('order','reviewed_at.asc');
  url.searchParams.set('limit','40');
  const response=await fetchImpl(url,{headers:readHeaders(service)});
  if(!response.ok)return [];
  const rows=await response.json();
  return (Array.isArray(rows)?rows:[]).map(row=>({observedAt:`${row.reviewed_at}T12:00:00.000Z`,products:Array.isArray(row.products)?row.products:[]}));
}

async function persistCurrentWindow({env,fetchImpl,window}){
  const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
  const service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if(!supabaseUrl||!service)return {ok:false,code:'PERSISTENCE_NOT_CONFIGURED'};
  const url=new URL(`${supabaseUrl}/rest/v1/current_top25_snapshots_v1`);
  url.searchParams.set('on_conflict','niche_id,platform,market,window_days,window_end');
  const body=[{
    niche_id:window.nicheId,
    platform:window.platform,
    market:window.market,
    window_days:window.windowDays,
    window_end:window.windowEnd,
    products:window.products,
    product_count:window.productCount,
    evidence_class:window.evidenceClass,
    source_key:'EBAY_BUY_MARKETING_BEST_SELLING',
    source_label:'eBay Buy Marketing API · BEST_SELLING',
    source_rights_status:'APPROVED_OFFICIAL_API',
    freshness_status:window.freshnessStatus
  }];
  const response=await fetchImpl(url,{method:'POST',headers:serviceHeaders(service),body:JSON.stringify(body)});
  return response.ok?{ok:true,code:'CURRENT_WINDOW_PERSISTED'}:{ok:false,code:`CURRENT_WINDOW_HTTP_${response.status}`};
}

async function refreshCurrentWindows({env,fetchImpl,target,dailyNicheId,timestamp}){
  const history=await loadRecentDailySnapshots({env,fetchImpl,nicheId:dailyNicheId,windowEnd:timestamp});
  const windowEnd=new Date(`${timestamp.toISOString().slice(0,10)}T23:59:59.999Z`);
  const windows=[];
  for(const windowDays of [7,30]){
    const window=buildCurrentTop25Window({snapshots:history,windowDays,windowEnd,platform:'EBAY',market:target.marketplaceId,nicheId:target.nicheId});
    const persisted=await persistCurrentWindow({env,fetchImpl,window});
    windows.push({windowDays,productCount:window.productCount,observedDays:window.observedDays,evidenceClass:window.evidenceClass,freshnessStatus:window.freshnessStatus,persisted:persisted.ok,status:persisted.code});
  }
  return windows;
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
        if(!collected.ok){results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:collected.code,published:false,windows:[]});continue;}
        const dailyNicheId=`XMARKET:EBAY:${target.nicheId}`;
        const persisted=await persistSnapshot({env,fetchImpl,nicheId:dailyNicheId,reviewedAt,products:collected.products});
        const windows=persisted.ok?await refreshCurrentWindows({env,fetchImpl,target,dailyNicheId,timestamp}):[];
        results.push({nicheId:target.nicheId,marketplaceId:target.marketplaceId,status:persisted.code,published:persisted.ok,windows});
      }
      const published=results.filter(row=>row.published).length;
      const currentWindowsPersisted=results.flatMap(row=>row.windows||[]).filter(row=>row.persisted).length;
      return Response.json({ok:published>0,status:published>0?'REFRESHED':'NO_PUBLISHABLE_TOP25',published,currentWindowsPersisted,targets:targets.length,results,policy:{requiredCount:25,currentWindows:[7,30],noSyntheticRankings:true,purchaseAuthorized:false}},{status:published>0?200:422,headers:{'Cache-Control':'no-store'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error),published:0},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {persistSnapshot,persistCurrentWindow,loadRecentDailySnapshots,refreshCurrentWindows};
export default createEbayCrossMarketRefreshHandler();
export const config={path:'/api/internal/ebay-cross-market-refresh',method:'POST'};
