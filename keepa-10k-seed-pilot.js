// Mega Product Radar · Keepa 10K Seed Pilot V1
// Converts MPR taxonomy labels into a zero-network Keepa acquisition plan.

import {flattenCategoryUniverse} from './category-universe-engine.js';
import {buildKeepaBestSellerPlan} from './keepa-acquisition-adapter.js';

const clean=v=>String(v??'').trim();
const uniq=values=>[...new Set((values||[]).map(clean).filter(Boolean))];

export function buildKeepaCategoryResolutionPlan(universe,{domain=3,level='CATEGORY',maxNodes=40}={}){
  const nodes=flattenCategoryUniverse(universe).filter(row=>row.level===level).slice(0,Math.max(0,Number(maxNodes)||0));
  const tasks=nodes.map(row=>({
    type:'CATEGORY_SEARCH',
    domain:Number(domain)||3,
    mprKey:row.key,
    parentKey:row.parentKey||null,
    searchTerm:row.label,
    estimatedTokens:1,
    executeAutomatically:false
  }));
  return {
    provider:'KEEPA',
    strategy:'MPR_TAXONOMY_TO_KEEPA_CATEGORY_IDS',
    nodeLevel:level,
    taskCount:tasks.length,
    estimatedTokens:tasks.length,
    tasks,
    paidExecutionAuthorized:false
  };
}

export function resolveKeepaCategoryMatches(resolutionPlan,matches=[]){
  const byKey=new Map((matches||[]).map(row=>[clean(row.mprKey),row]));
  return (resolutionPlan?.tasks||[]).map(task=>{
    const match=byKey.get(clean(task.mprKey));
    const categoryId=clean(match?.categoryId);
    const confidence=Number(match?.confidence);
    const accepted=Boolean(categoryId)&&Number.isFinite(confidence)&&confidence>=70&&match?.manuallyReviewed===true;
    return {
      mprKey:task.mprKey,
      searchTerm:task.searchTerm,
      categoryId:accepted?categoryId:null,
      confidence:Number.isFinite(confidence)?confidence:null,
      manuallyReviewed:match?.manuallyReviewed===true,
      accepted,
      reason:accepted?'MANUALLY_REVIEWED_MATCH':'REVIEW_REQUIRED'
    };
  });
}

export function buildTenKSeedPlan({resolvedCategories=[],targetProducts=10000,domain=3,maxCategories=40}={}){
  const accepted=(resolvedCategories||[]).filter(x=>x?.accepted===true&&clean(x.categoryId)).slice(0,Math.max(1,Number(maxCategories)||40));
  const target=Math.max(0,Number(targetProducts)||0);
  if(!accepted.length)return{targetProducts:target,categoryCount:0,allocationPerCategory:0,bestSellerPlan:buildKeepaBestSellerPlan({domain,categoryIds:[]}),selectionPolicy:'NO_ACCEPTED_CATEGORIES',paidExecutionAuthorized:false};
  const allocation=Math.ceil(target/accepted.length);
  const categoryIds=uniq(accepted.map(x=>x.categoryId));
  const bestSellerPlan=buildKeepaBestSellerPlan({domain,categoryIds,maxLists:maxCategories});
  return {
    targetProducts:target,
    categoryCount:categoryIds.length,
    allocationPerCategory:allocation,
    candidateCapPerCategory:Math.min(100000,allocation),
    estimatedCategoryResolutionTokens:accepted.length,
    bestSellerPlan,
    selectionPolicy:'TAKE_UP_TO_ALLOCATION_PER_CATEGORY_DEDUPE_ASIN_STOP_AT_TARGET',
    expectedHydrationCap:target,
    estimatedHydrationTokens:target,
    totalEstimatedTokensAfterCategoryResolution:bestSellerPlan.estimatedTokens+target,
    paidExecutionAuthorized:false,
    purchaseAuthorized:false
  };
}

export function seedPilotReadiness({resolutionPlan,resolvedCategories,seedPlan}={}){
  const total=Number(resolutionPlan?.taskCount||0);
  const accepted=(resolvedCategories||[]).filter(x=>x?.accepted===true).length;
  const coveragePct=total>0?Number((accepted/total*100).toFixed(1)):0;
  const ready=accepted>=5&&Number(seedPlan?.targetProducts||0)>0&&Number(seedPlan?.categoryCount||0)>=5;
  return {
    ready,
    categoryResolutionCoveragePct:coveragePct,
    acceptedCategories:accepted,
    minimumAcceptedCategories:5,
    blocker:ready?null:'MANUALLY_REVIEW_AT_LEAST_5_KEEPA_CATEGORY_MATCHES',
    paidExecutionAuthorized:false
  };
}
