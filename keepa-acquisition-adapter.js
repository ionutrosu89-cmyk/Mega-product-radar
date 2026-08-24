// Mega Product Radar · Keepa Acquisition Adapter V1
// Planning + request specification only. No network execution lives in this module.

import {authorizeAcquisitionRun} from './data-acquisition-registry.js';

const finite=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const cleanString=v=>String(v??'').trim();
const uniq=values=>[...new Set((values||[]).map(cleanString).filter(Boolean))];

export const KEEPA_TOKEN_COSTS=Object.freeze({
  PRODUCT_BY_ASIN:1,
  PRODUCT_SEARCH_PAGE:10,
  CATEGORY_LOOKUP:1,
  CATEGORY_SEARCH:1,
  DEAL_BATCH_150:5,
  SELLER_LOOKUP:1,
  BEST_SELLERS_LIST:50
});

export function buildKeepaBestSellerPlan({domain=3,categoryIds=[],maxLists=20}={}){
  const categories=uniq(categoryIds).slice(0,Math.max(0,Number(maxLists)||0));
  const tasks=categories.map(categoryId=>({
    type:'BEST_SELLERS',
    domain:Number(domain)||3,
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
    paidExecutionAuthorized:false
  };
}

export function buildKeepaProductHydrationPlan({domain=3,asins=[],batchSize=100}={}){
  const ids=uniq(asins);
  const size=Math.max(1,Math.min(100,Number(batchSize)||100));
  const batches=[];
  for(let i=0;i<ids.length;i+=size){
    const chunk=ids.slice(i,i+size);
    batches.push({
      type:'PRODUCTS',
      domain:Number(domain)||3,
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
    paidExecutionAuthorized:false
  };
}

export function keepaRequestSpec(task={}){
  const type=cleanString(task.type).toUpperCase();
  if(type==='BEST_SELLERS'){
    const categoryId=cleanString(task.categoryId);
    if(!categoryId)return{valid:false,reason:'CATEGORY_ID_REQUIRED'};
    return {valid:true,method:'GET',baseUrl:'https://api.keepa.com',path:'/bestsellers',params:{domain:Number(task.domain)||3,category:categoryId},requiresSecret:'KEEPA_API_KEY'};
  }
  if(type==='PRODUCTS'){
    const asins=uniq(task.asins);
    if(!asins.length)return{valid:false,reason:'ASINS_REQUIRED'};
    return {valid:true,method:'GET',baseUrl:'https://api.keepa.com',path:'/product',params:{domain:Number(task.domain)||3,asin:asins.join(',')},requiresSecret:'KEEPA_API_KEY'};
  }
  return{valid:false,reason:'UNSUPPORTED_TASK'};
}

export function authorizeKeepaPlan(plan,{explicitApproval=false,budgetRemainingEur=0,monthlyPriceEur=null}={}){
  const tokenCount=finite(plan?.estimatedTokens);
  if(tokenCount===null||tokenCount<0)return{authorized:false,reason:'TOKEN_ESTIMATE_REQUIRED',executeAutomatically:false};
  const base=authorizeAcquisitionRun('KEEPA',{explicitApproval,budgetRemainingEur,monthlyPriceOverrideEur:monthlyPriceEur});
  return {...base,estimatedTokens:tokenCount,executeAutomatically:false};
}

export function normalizeKeepaIdentity(product={}){
  const asin=cleanString(product.asin);
  if(!asin)return null;
  return {
    source:'KEEPA',
    marketplace:'AMAZON',
    externalId:asin,
    title:cleanString(product.title)||null,
    brand:cleanString(product.brand)||null,
    rootCategory:product.rootCategory??null,
    observedAt:new Date().toISOString(),
    evidenceClass:'LICENSED_PROVIDER',
    rawSalesVerified:false,
    purchaseAuthorized:false
  };
}
