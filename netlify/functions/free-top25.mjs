import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {buildFreeTop25LiveUniverse} from '../../free-top25-live-v1.js';
import {FREE_TOP25_EXPANDED_REGISTRY} from '../../free-top25-expanded-registry.js';
import {SAAS_CONFIG} from '../../saas-config.js';
import {enforceRateLimit} from './_security-ops.mjs';
import {classifyPublicBrandGate} from '../../brand-policy-v1.js';
import {classifyPublicCategoryRisk} from '../../public-category-risk-policy-v1.js';

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
  const categoryRisk=classifyPublicCategoryRisk(row);
  const commercialEligible=brandGate.commercialEligible&&categoryRisk.commercialEligible;
  const commercialGate=!brandGate.commercialEligible?'STOP_BRAND_GATE':!categoryRisk.commercialEligible?(categoryRisk.decision==='BLOCK'?'STOP_CATEGORY_GATE':'STOP_CATEGORY_REVIEW'):'BRAND_REVIEW_REQUIRED';
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
    commercialGate,
    brandPolicyClass:brandGate.brandPolicyClass,
    categoryRiskClass:categoryRisk.riskClass,
    categoryRiskDecision:categoryRisk.decision,
    commercialEligible,
    brandPolicyReason:brandGate.reason,
    categoryRiskReason:categoryRisk.reason
  };
}

function sanitizeEligibleSnapshot(row){
  const raw=Array.isArray(row?.products)?row.products:[];
  if(raw.length!==25)return null;
  const products=raw.map(safeExpandedProduct);
  if(products.some(product=>product===null))return null;
  const uniqueAsins=new Set(products.map(product=>product.asin));
  if(uniqueAsins.size!==25)return null;
  return {
    reviewedAt:String(row?.reviewed_at||''),
    products
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
  url.searchParams.set('order','reviewed_at.desc,created_at.desc');
  url.searchParams.set('limit','100');
  const response=await fetchImpl(url,{headers:supabaseHeaders(serviceRole)});
  if(!response.ok)return [];
  const rows=await response.json();

  const eligibleById=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const id=String(row?.niche_id||'');
    if(!id||eligibleById.has(id))continue;
    const sanitized=sanitizeEligibleSnapshot(row);
    if(sanitized)eligibleById.set(id,sanitized);
  }

  return FREE_TOP25_EXPANDED_REGISTRY.flatMap(meta=>{
    const eligible=eligibleById.get(meta.id);
    if(!eligible)return [];
    return [{...meta,mode:'LICENSED_HISTORICAL_EVIDENCE',reviewedAt:eligible.reviewedAt,products:eligible.products,eligibleProductCount:25}];
  });
}

export function createFreeTop25Handler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'free-top25',workspaceId:null,userId:null,limit:90,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});

      const expandedNiches=await loadExpandedTop25Niches({env,fetchImpl}).catch(()=>[]);
      if(expandedNiches.length!==25){
        return Response.json({
          ok:false,
          error:'Free Top25 public evidence gate incomplete',
          code:'FREE_TOP25_PUBLIC_EVIDENCE_INCOMPLETE',
          stats:{requiredNicheCount:25,eligibleNicheCount:expandedNiches.length,requiredProductCount:625,eligibleProductCount:expandedNiches.length*25}
        },{status:503,headers:{'Cache-Control':'no-store'}});
      }

      const discovery=await loadSource(fetchImpl,request.url,'discovery-live.json');
      const organic=await loadSource(fetchImpl,request.url,'organic-rising-live.json');
      const universe=buildFreeTop25LiveUniverse({
        discoveryProducts:Array.isArray(discovery.data?.products)?discovery.data.products:[],
        organicProducts:Array.isArray(organic.data?.products)?organic.data.products:[]
      });
      const expandedUpdatedAt=expandedNiches.map(niche=>niche.reviewedAt).filter(Boolean).sort().at(-1)||null;
      const categoryReviewCount=expandedNiches.flatMap(niche=>niche.products).filter(product=>product.categoryRiskDecision!=='ALLOW').length;
      const brandHoldCount=expandedNiches.flatMap(niche=>niche.products).filter(product=>product.brandPolicyClass==='ESTABLISHED_EXCLUDE').length;
      return Response.json({
        ok:true,
        ...universe,
        stats:{...universe.stats,completeNicheCount:25,expandedNicheCount:25,expandedProductCount:625,publishedNicheCount:25,publishedProductCount:625,categoryReviewCount,brandHoldCount},
        niches:expandedNiches,
        sourceDiagnostics:{publicCatalog:'LICENSED_HISTORICAL_EVIDENCE',discovery:discovery.via,organic:organic.via},
        updatedAt:expandedUpdatedAt
      },{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=900'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createFreeTop25Handler();
export const config={path:'/api/free/top25',method:'GET'};
