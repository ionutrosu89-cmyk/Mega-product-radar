import {SAAS_CONFIG} from '../../saas-config.js';
import {hasFeature,planByCode} from '../../billing-plans.js';

const DISCOVER_SIGNAL_KEYS=['amazonUS','amazonDE','amazonIT','amazonFR','tiktok'];

function cleanLink(link={}){return {label:String(link.label||''),title:String(link.title||''),url:String(link.url||'')};}
function cleanSignal(signal={}){return {label:String(signal.label||''),present:Boolean(signal.present),resultCount:Number(signal.resultCount||0),searchUrl:String(signal.searchUrl||''),links:Array.isArray(signal.links)?signal.links.slice(0,2).map(cleanLink):[]};}
function cleanProduct(p={}){
  const signals={};
  for(const key of DISCOVER_SIGNAL_KEYS) if(p?.signals?.[key]) signals[key]=cleanSignal(p.signals[key]);
  return {
    name:String(p.name||''),cat:String(p.cat||''),imageUrl:String(p.imageUrl||''),sourceStatus:String(p.sourceStatus||'PARTIAL'),
    firstDiscoveredAt:p.firstDiscoveredAt||null,
    trendWindows:{d7:p?.trendWindows?.d7||null,d30:p?.trendWindows?.d30||null},
    reviewIntel:{sourceCount:Number(p?.reviewIntel?.sourceCount||0),snippetCount:Number(p?.reviewIntel?.snippetCount||0),confidence:String(p?.reviewIntel?.confidence||'LOW')},
    discoveryAnalysis:{score:Number(p?.discoveryAnalysis?.score||p?.score||0),quality:{level:String(p?.discoveryAnalysis?.quality?.level||p.sourceStatus||'PARTIAL')}},
    signals
  };
}

async function resolvePlan(request,{fetchImpl,env}){
  const auth=request.headers.get('authorization')||'';
  if(!auth) return {plan:planByCode('FREE'),authenticated:false,workspaceId:null};
  if(!/^Bearer\s+\S+/i.test(auth)) return {error:'Invalid authorization header',status:401};
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const apiKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
  const headers={apikey:apiKey,authorization:auth};
  const userResponse=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
  if(!userResponse.ok) return {error:'Invalid or expired session',status:401};
  const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,name,plan&limit=1`,{headers:{...headers,accept:'application/json'}});
  if(!workspaceResponse.ok) return {error:'Workspace lookup failed',status:502};
  const rows=await workspaceResponse.json();
  const workspace=Array.isArray(rows)?rows[0]:null;
  const plan=planByCode(workspace?.plan||'FREE');
  return {plan,authenticated:true,workspaceId:workspace?.id||null};
}

export function createCommercialDiscoverHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const access=await resolvePlan(request,{fetchImpl,env});
      if(access.error) return Response.json({ok:false,error:access.error},{status:access.status,headers:{'Cache-Control':'no-store'}});
      const sourceUrl=new URL('/discovery-live.json',request.url);
      const sourceResponse=await fetchImpl(sourceUrl,{headers:{accept:'application/json'}});
      if(!sourceResponse.ok) return Response.json({ok:false,error:'Discover source unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const source=await sourceResponse.json();
      const full=hasFeature(access.plan.code,'TOP_PRODUCTS');
      const limit=full?20:3;
      const products=(Array.isArray(source.products)?source.products:[]).map(cleanProduct).sort((a,b)=>b.discoveryAnalysis.score-a.discoveryAnalysis.score).slice(0,limit);
      return Response.json({
        ok:true,
        plan:access.plan.code,
        authenticated:access.authenticated,
        workspaceId:access.workspaceId,
        limits:{products:limit},
        entitlements:{discoverFull:full,radar:hasFeature(access.plan.code,'RADAR'),launch:hasFeature(access.plan.code,'LAUNCH_PLAN')},
        integrity:{sales:'NOT_EXPOSED_WITHOUT_VERIFIABLE_PROVIDER',classification:'DERIVED'},
        updatedAt:source.updatedAt||null,
        products
      },{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export default createCommercialDiscoverHandler();
export const config={path:'/api/commercial/discover',method:'GET'};
