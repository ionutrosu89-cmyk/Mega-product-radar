import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {SAAS_CONFIG} from '../../saas-config.js';
import {hasFeature,planByCode} from '../../billing-plans.js';

const DISCOVER_SIGNAL_KEYS=['amazonUS','amazonDE','amazonIT','amazonFR','tiktok'];
const AMAZON_KEYS=['amazonUS','amazonDE','amazonIT','amazonFR'];

function cleanLink(link={}){return {label:String(link.label||''),title:String(link.title||''),url:String(link.url||'')};}
function cleanSignal(signal={}){return {label:String(signal.label||''),present:Boolean(signal.present),resultCount:Number(signal.resultCount||0),searchUrl:String(signal.searchUrl||''),links:Array.isArray(signal.links)?signal.links.slice(0,2).map(cleanLink):[],evidenceClass:String(signal.evidenceClass||'DERIVED')};}
function cleanProduct(p={}){
  const signals={};
  for(const key of DISCOVER_SIGNAL_KEYS) if(p?.signals?.[key]) signals[key]=cleanSignal(p.signals[key]);
  return {
    name:String(p.name||''),cat:String(p.cat||''),imageUrl:String(p.imageUrl||''),sourceStatus:String(p.sourceStatus||'PARTIAL'),origin:String(p.origin||'DISCOVERY'),
    firstDiscoveredAt:p.firstDiscoveredAt||null,
    trendWindows:{d7:p?.trendWindows?.d7||null,d30:p?.trendWindows?.d30||null},
    risingSignal:p?.risingSignal?{eligible:Boolean(p.risingSignal.eligible),score:Number(p.risingSignal.score||0),rankDelta:Number(p.risingSignal.rankDelta||0),sourceMarket:String(p.risingSignal.sourceMarket||''),evidenceClass:String(p.risingSignal.evidenceClass||'VERIFIED')}:null,
    reviewIntel:{sourceCount:Number(p?.reviewIntel?.sourceCount||0),snippetCount:Number(p?.reviewIntel?.snippetCount||0),confidence:String(p?.reviewIntel?.confidence||'LOW')},
    discoveryAnalysis:{score:Number(p?.discoveryAnalysis?.score||p?.score||0),quality:{level:String(p?.discoveryAnalysis?.quality?.level||p.sourceStatus||'PARTIAL')}},
    signals
  };
}

function organicToDiscover(p={}){
  const marketKey=String(p.sourceMarketKey||'');
  if(!DISCOVER_SIGNAL_KEYS.includes(marketKey)) return null;
  if(!p.eligibleForFeed||!p?.qualityGate?.topTwoPages||!p?.qualityGate?.notPromoted||!p?.qualityGate?.categoryRelevant) return null;
  const evidence=(Array.isArray(p.evidence)?p.evidence:[]).filter(x=>x?.url).slice(0,2).map(x=>({label:String(x.marketLabel||p.sourceMarket||''),title:String(x.title||p.name||''),url:String(x.url||'')}));
  if(!evidence.length&&!p.sourceUrl) return null;
  const links=evidence.length?evidence:[{label:String(p.sourceMarket||''),title:String(p.name||''),url:String(p.sourceUrl||'')}];
  const signals={
    [marketKey]:{label:String(p.sourceMarket||marketKey),present:true,resultCount:1,searchUrl:String(p.sourceUrl||''),links,evidenceClass:'VERIFIED'}
  };
  return cleanProduct({
    name:p.name,cat:p.category,imageUrl:p.image,sourceStatus:'LIVE',origin:'ORGANIC_RISING',firstDiscoveredAt:p.firstSeenAt,
    risingSignal:{eligible:true,score:Number(p.organicRiseScore||0),rankDelta:Number(p.rankDelta||0),sourceMarket:String(p.sourceMarket||''),evidenceClass:'VERIFIED'},
    reviewIntel:{sourceCount:p.reviewCount!=null?1:0,snippetCount:0,confidence:p?.qualityGate?.exactSourceReview?'HIGH':'MEDIUM'},
    discoveryAnalysis:{score:Number(p.organicRiseScore||0),quality:{level:'LIVE'}},signals
  });
}

function hasDirectObservedEvidence(p={}){
  return DISCOVER_SIGNAL_KEYS.some(key=>{
    const signal=p?.signals?.[key];
    if(!signal?.present) return false;
    return (Array.isArray(signal.links)?signal.links:[]).some(link=>/^https?:\/\//i.test(String(link?.url||'')));
  });
}

function normalizeName(value=''){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function evidenceWeight(p={}){const verified=Object.values(p.signals||{}).filter(s=>s.present&&s.evidenceClass==='VERIFIED').length;const amazon=AMAZON_KEYS.some(k=>p?.signals?.[k]?.present)?1:0;return verified*1000+amazon*100+(p?.risingSignal?.eligible?50:0)+Number(p?.discoveryAnalysis?.score||0);}
function mergeProducts(discovery=[],organic=[]){
  const map=new Map();
  for(const p of [...organic,...discovery]){
    const key=normalizeName(p.name);if(!key)continue;
    const current=map.get(key);
    if(!current||evidenceWeight(p)>evidenceWeight(current))map.set(key,p);
  }
  return [...map.values()].sort((a,b)=>evidenceWeight(b)-evidenceWeight(a));
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

async function fetchJson(fetchImpl,url){const r=await fetchImpl(url,{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
async function readBundledJson(filename){
  const candidates=[path.join(process.cwd(),filename),path.join(process.cwd(),'..',filename),path.join(process.cwd(),'../..',filename)];
  let lastError=null;
  for(const file of candidates){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){lastError=error;}}
  throw lastError||new Error(`Bundled source unavailable: ${filename}`);
}
async function loadSource(fetchImpl,requestUrl,filename){
  const url=new URL(`/${filename}`,requestUrl);
  try{return {data:await fetchJson(fetchImpl,url),via:'HTTP',error:null};}
  catch(httpError){
    try{return {data:await readBundledJson(filename),via:'BUNDLED_FILE',error:String(httpError?.message||httpError)};}
    catch(fileError){return {data:null,via:'UNAVAILABLE',error:`HTTP:${String(httpError?.message||httpError)}; FILE:${String(fileError?.message||fileError)}`};}
  }
}

export function createCommercialDiscoverHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const access=await resolvePlan(request,{fetchImpl,env});
      if(access.error) return Response.json({ok:false,error:access.error},{status:access.status,headers:{'Cache-Control':'no-store'}});
      const discoverySource=await loadSource(fetchImpl,request.url,'discovery-live.json');
      if(!discoverySource.data) return Response.json({ok:false,error:'Discover source unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const organicSource=await loadSource(fetchImpl,request.url,'organic-rising-live.json');
      const source=discoverySource.data;
      const organic=organicSource.data||{products:[],updatedAt:null};
      const discoveryProducts=(Array.isArray(source.products)?source.products:[]).map(cleanProduct);
      const organicProducts=(Array.isArray(organic.products)?organic.products:[]).map(organicToDiscover).filter(Boolean);
      const merged=mergeProducts(discoveryProducts,organicProducts);
      const evidenceBackedProducts=merged.filter(hasDirectObservedEvidence);
      const full=hasFeature(access.plan.code,'TOP_PRODUCTS');
      const limit=full?20:3;
      const products=evidenceBackedProducts.slice(0,limit);
      const amazonEvidenceCount=products.filter(p=>AMAZON_KEYS.some(k=>p?.signals?.[k]?.present)).length;
      const risingCount=products.filter(p=>p?.risingSignal?.eligible).length;
      return Response.json({
        ok:true,
        plan:access.plan.code,
        authenticated:access.authenticated,
        workspaceId:access.workspaceId,
        limits:{products:limit},
        entitlements:{discoverFull:full,radar:hasFeature(access.plan.code,'RADAR'),launch:hasFeature(access.plan.code,'LAUNCH_PLAN')},
        integrity:{sales:'NOT_EXPOSED_WITHOUT_VERIFIABLE_PROVIDER',classification:'SOURCE_REQUIRED_FOR_COMMERCIAL_FEED',organicRising:'VERIFIED_LISTING_EVIDENCE_ONLY'},
        sourceDiagnostics:{policy:'DIRECT_PUBLIC_SOURCE_REQUIRED',discoverySourceStatus:discoverySource.via,organicSourceStatus:organicSource.via,organicEligibleProducts:organicProducts.length,evidenceBackedProducts:evidenceBackedProducts.length,excludedWithoutDirectSource:Math.max(0,merged.length-evidenceBackedProducts.length),amazonEvidenceCount,risingCount},
        updatedAt:[source.updatedAt,organic.updatedAt].filter(Boolean).sort().at(-1)||null,
        products
      },{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export default createCommercialDiscoverHandler();
export const config={path:'/api/commercial/discover',method:'GET'};
