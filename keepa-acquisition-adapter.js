// Mega Product Radar · Keepa Acquisition Adapter V1
// Planning + request specification only. No network execution lives in this module.

import {authorizeAcquisitionRun} from './data-acquisition-registry.js';

const finite=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const cleanString=v=>String(v??'').trim();
const uniq=values=>[...new Set((values||[]).map(cleanString).filter(Boolean))];
const supportedDomain=domain=>[1,3].includes(Number(domain))?Number(domain):null;
const validAsin=value=>/^[A-Z0-9]{10}$/.test(cleanString(value).toUpperCase());

export function keepaTimeToIso(value){
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const minutes=Number(value);
  if(!Number.isInteger(minutes)||minutes<0)return null;
  const milliseconds=(minutes+21_564_000)*60_000;
  const date=new Date(milliseconds);
  return Number.isFinite(date.getTime())?date.toISOString():null;
}

export function normalizeKeepaBestSellerList(payload,{domain=1,categoryId,now=new Date(),maxAgeHours=72,limit=100}={}){
  const expectedDomain=supportedDomain(domain),list=payload?.bestSellersList;
  if(expectedDomain===null||!/^\d+$/.test(cleanString(categoryId))||Number(list?.domainId)!==expectedDomain||cleanString(list?.categoryId)!==cleanString(categoryId))return {ok:false,code:'MARKET_OR_CATEGORY_MISMATCH',candidates:[]};
  const sourceUpdatedAt=keepaTimeToIso(list?.lastUpdate),current=now instanceof Date?now:new Date(now);
  const ageMs=current.getTime()-Date.parse(sourceUpdatedAt||'');
  const permittedAgeHours=Number(maxAgeHours);
  if(!sourceUpdatedAt||!Number.isFinite(ageMs)||!Number.isFinite(permittedAgeHours)||permittedAgeHours<=0||permittedAgeHours>72||ageMs<0||ageMs>permittedAgeHours*3_600_000)return {ok:false,code:'STALE_OR_UNKNOWN_SOURCE_UPDATE',candidates:[]};
  const source=Array.isArray(list?.asinList)?list.asinList:[],seen=new Set(),candidates=[];
  for(let index=0;index<source.length&&candidates.length<limit;index++){
    const asin=cleanString(source[index]).toUpperCase();
    if(!validAsin(asin)||seen.has(asin))continue;
    seen.add(asin);
    candidates.push({externalId:asin,sourceRank:index+1,sourceUpdatedAt,sourceKey:'KEEPA_BEST_SELLERS',market:expectedDomain===1?'AMAZON_US':'AMAZON_DE',rankingBasis:'KEEPA_BEST_SELLER_LIST'});
  }
  return {ok:candidates.length>=25,code:candidates.length>=25?'READY':'INSUFFICIENT_RANKED_CANDIDATES',sourceUpdatedAt,candidates};
}

export const KEEPA_TOKEN_COSTS=Object.freeze({
  PRODUCT_BY_ASIN:1,
  PRODUCT_SEARCH_PAGE:10,
  CATEGORY_LOOKUP:1,
  CATEGORY_SEARCH:1,
  DEAL_BATCH_150:5,
  SELLER_LOOKUP:1,
  BEST_SELLERS_LIST:50
});

export function buildKeepaBestSellerPlan({domain=1,categoryIds=[],maxLists=20}={}){
  const domainId=supportedDomain(domain);
  const categories=uniq(categoryIds).slice(0,Math.max(0,Number(maxLists)||0));
  const tasks=(domainId===null?[]:categories).map(categoryId=>({
    type:'BEST_SELLERS',
    domain:domainId,
    categoryId,
    tokenCost:KEEPA_TOKEN_COSTS.BEST_SELLERS_LIST,
    maxProviderAsins:100000,
    executeAutomatically:false
  }));
  return {
    provider:'KEEPA',
    strategy:'CATEGORY_BEST_SELLERS_BREADTH_SEED',
    taskCount:tasks.length,
    estimatedTokens:tasks.reduce((sum,t)=>sum+t.tokenCost,0),
    tasks,
    valid:domainId!==null,
    reason:domainId===null?'UNSUPPORTED_DOMAIN':null,
    paidExecutionAuthorized:false
  };
}

export function buildKeepaProductHydrationPlan({domain=1,asins=[],batchSize=100}={}){
  const domainId=supportedDomain(domain);
  const ids=uniq(asins);
  const size=Math.max(1,Math.min(100,Number(batchSize)||100));
  const batches=[];
  for(let i=0;domainId!==null&&i<ids.length;i+=size){
    const chunk=ids.slice(i,i+size);
    batches.push({
      type:'PRODUCTS',
      domain:domainId,
      asins:chunk,
      estimatedTokens:chunk.length*KEEPA_TOKEN_COSTS.PRODUCT_BY_ASIN,
      executeAutomatically:false
    });
  }
  return {
    provider:'KEEPA',
    strategy:'ASIN_HYDRATION',
    asinCount:ids.length,
    batchCount:batches.length,
    estimatedTokens:batches.reduce((sum,b)=>sum+b.estimatedTokens,0),
    batches,
    valid:domainId!==null,
    reason:domainId===null?'UNSUPPORTED_DOMAIN':null,
    paidExecutionAuthorized:false
  };
}

export function keepaRequestSpec(task={}){
  const type=cleanString(task.type).toUpperCase();
  const domain=supportedDomain(task.domain);
  if(domain===null)return {valid:false,reason:'UNSUPPORTED_DOMAIN'};
  if(type==='BEST_SELLERS'){
    const categoryId=cleanString(task.categoryId);
    if(!categoryId)return{valid:false,reason:'CATEGORY_ID_REQUIRED'};
    return {valid:true,method:'GET',baseUrl:'https://api.keepa.com',path:'/bestsellers',params:{domain,category:categoryId},requiresSecret:'KEEPA_API_KEY'};
  }
  if(type==='PRODUCTS'){
    const asins=uniq(task.asins);
    if(!asins.length)return{valid:false,reason:'ASINS_REQUIRED'};
    return {valid:true,method:'GET',baseUrl:'https://api.keepa.com',path:'/product',params:{domain,asin:asins.join(',')},requiresSecret:'KEEPA_API_KEY'};
  }
  return{valid:false,reason:'UNSUPPORTED_TASK'};
}

export function authorizeKeepaPlan(plan,{explicitApproval=false,budgetRemainingEur=0,monthlyPriceEur=null}={}){
  if(plan?.valid===false)return {authorized:false,reason:plan.reason||'INVALID_PLAN',executeAutomatically:false};
  const tokenCount=finite(plan?.estimatedTokens);
  if(tokenCount===null||tokenCount<0)return{authorized:false,reason:'TOKEN_ESTIMATE_REQUIRED',executeAutomatically:false};
  const base=authorizeAcquisitionRun('KEEPA',{explicitApproval,budgetRemainingEur,monthlyPriceOverrideEur:monthlyPriceEur});
  return {...base,estimatedTokens:tokenCount,executeAutomatically:false};
}

export function normalizeKeepaIdentity(product={},options={}){
  const asin=cleanString(product.asin);
  if(!asin)return null;
  const observedAt=Number.isFinite(Date.parse(options.observedAt||''))?new Date(options.observedAt).toISOString():null;
  return {
    source:'KEEPA',
    marketplace:'AMAZON',
    externalId:asin,
    title:cleanString(product.title)||null,
    brand:cleanString(product.brand)||null,
    rootCategory:product.rootCategory??null,
    observedAt,
    sourceUpdatedAt:keepaTimeToIso(product.lastUpdate),
    evidenceClass:'LICENSED_PROVIDER',
    rawSalesVerified:false,
    purchaseAuthorized:false
  };
}
