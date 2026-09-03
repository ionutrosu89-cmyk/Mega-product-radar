import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildFreeTop25LiveUniverse} from '../../free-top25-live-v1.js';
import {FREE_TOP25_EXPANDED_REGISTRY} from '../../free-top25-expanded-registry.js';
import {SAAS_CONFIG} from '../../saas-config.js';
import {enforceRateLimit} from './_security-ops.mjs';
import {classifyPublicBrandGate} from '../../brand-policy-v1.js';

async function fetchJson(fetchImpl,url){
  const response=await fetchImpl(url,{headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function readBundledJson(filename){
  const candidates=[path.join(process.cwd(),filename),path.join(process.cwd(),'..',filename),path.join(process.cwd(),'../..',filename)];
  let lastError=null;
  for(const file of candidates){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){lastError=error;}}
  throw lastError||new Error(`Bundled source unavailable: ${filename}`);
}
async function loadSource(fetchImpl,requestUrl,filename){
  const url=new URL(`/${filename}`,requestUrl);
  try{return {data:await fetchJson(fetchImpl,url),via:'HTTP'};}catch(httpError){
    try{return {data:await readBundledJson(filename),via:'BUNDLED_FILE'};}catch(fileError){return {data:null,via:'UNAVAILABLE',error:`HTTP:${String(httpError?.message||httpError)}; FILE:${String(fileError?.message||fileError)}`};}
  }
}

function supabaseHeaders(serviceRole){
  return {apikey:serviceRole,authorization:`Bearer ${serviceRole}`,accept:'application/json'};
}

function safeExpandedProduct(product,index){
  const row=product&&typeof product==='object'?product:{};
  const name=String(row.name||'').trim();
  const asin=String(row.asin||'').trim().toUpperCase();
  const metricValue=Number(row?.metric?.value);
  if(!name||!/^([A-Z0-9]{10})$/.test(asin)||row.sourceKey!=='KAGGLE_AMAZON_PRODUCTS_2023')return null;
  const brandGate=classifyPublicBrandGate(row);
  return {
    name,
    asin,
    rank:index+1,
    sourceKey:'KAGGLE_AMAZON_PRODUCTS_2023',
    sourceLabel:'Kaggle · Amazon Products Dataset 2023 (ODC-By)',
    sourceUrl:'https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products',
    sourceTier:'B',
    sourceKind:'HISTORICAL_DATASET',
    sourcePeriod:'snapshot Sep 2023',
    sourceRank:null,
    metric:Number.isFinite(metricValue)&&metricValue>0?{label:'Recenzii istorice observate',value:metricValue,unit:'reviews_historical'}:null,
    note:'Produs din catalogul istoric licențiat. Nu reprezintă vânzări curente, disponibilitate live sau recomandare de import.',
    internalRankClass:'DERIVED',
    evidenceClass:'DERIVED',
    commercialGate:brandGate.commercialEligible?'BRAND_REVIEW_REQUIRED':'STOP_BRAND_GATE',
    brandPolicyClass:brandGate.brandPolicyClass,
    commercialEligible:brandGate.commercialEligible,
    brandPolicyReason:brandGate.reason
  };
}

export async function loadExpandedTop25Niches({env=process.env,fetchImpl=fetch}={}){
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const serviceRole=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceRole)return [];
  const ids=FREE_TOP25_EXPANDED_REGISTRY.map(row=>`"${row.id}"`).join(',');
  const url=new URL(`${supabaseUrl}/rest/v1/top25_snapshots`);
  url.searchParams.set('select','niche_id,reviewed_at,products');
  url.searchParams.set('niche_id',`in.(${ids})`);
  url.searchParams.set('order','reviewed_at.desc');
  url.searchParams.set('limit','100');
  const response=await fetchImpl(url,{headers:supabaseHeaders(serviceRole)});
  if(!response.ok)return [];
  const rows=await response.json();
  const latestById=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const id=String(row?.niche_id||'');
    const current=latestById.get(id);
    if(!current||String(row?.reviewed_at||'')>String(current?.reviewed_at||''))latestById.set(id,row);
  }
  return FREE_TOP25_EXPANDED_REGISTRY.flatMap(meta=>{
    const row=latestById.get(meta.id);
    const products=(Array.isArray(row?.products)?row.products:[]).slice(0,25).map(safeExpandedProduct).filter(Boolean);
    if(products.length!==25)return [];
    return [{...meta,mode:'LICENSED_HISTORICAL_EVIDENCE',reviewedAt:String(row.reviewed_at||''),products,eligibleProductCount:25}];
  });
}

export function createFreeTop25Handler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-top25',workspaceId:null,userId:null,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const discovery=await loadSource(fetchImpl,request.url,'discovery-live.json');
      const organic=await loadSource(fetchImpl,request.url,'organic-rising-live.json');
      if(!discovery.data&&!organic.data)return Response.json({ok:false,error:'Free Top25 live sources unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const universe=buildFreeTop25LiveUniverse({
        discoveryProducts:Array.isArray(discovery.data?.products)?discovery.data.products:[],
        organicProducts:Array.isArray(organic.data?.products)?organic.data.products:[]
      });
      const expandedNiches=await loadExpandedTop25Niches({env,fetchImpl}).catch(()=>[]);
      const publishedNiches=expandedNiches.length===25?expandedNiches:[...universe.niches,...expandedNiches].slice(0,25);
      const expandedUpdatedAt=expandedNiches.map(niche=>niche.reviewedAt).filter(Boolean).sort().at(-1)||null;
      return Response.json({
        ok:true,
        ...universe,
        stats:{...universe.stats,completeNicheCount:publishedNiches.length,expandedNicheCount:expandedNiches.length,expandedProductCount:expandedNiches.length*25,publishedNicheCount:publishedNiches.length,publishedProductCount:publishedNiches.length*25},
        niches:publishedNiches,
        sourceDiagnostics:{discovery:discovery.via,organic:organic.via},
        updatedAt:[discovery.data?.updatedAt,organic.data?.updatedAt,expandedUpdatedAt].filter(Boolean).sort().at(-1)||null
      },{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createFreeTop25Handler();
export const config={path:'/api/free/top25',method:'GET'};
