// Mega Product Radar · DataForSEO Amazon Acquisition Adapter V1
// Planning and request specification only. Network execution is deliberately absent.

import {estimateProviderCost,authorizeAcquisitionRun} from './data-acquisition-registry.js';

const clean=v=>String(v??'').trim();
const uniq=values=>[...new Set((values||[]).map(clean).filter(Boolean))];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||min));

export function buildAmazonProductTasks({queries=[],locationName='Germany',languageName='German',depth=100,department=null}={}){
  const terms=uniq(queries);
  const normalizedDepth=clamp(depth,1,700);
  const billableSerpsPerTask=Math.ceil(normalizedDepth/100);
  const tasks=terms.map((keyword,index)=>({
    keyword,
    location_name:locationName,
    language_name:languageName,
    depth:normalizedDepth,
    ...(clean(department)?{department:clean(department)}:{}),
    tag:`mpr-amazon-seed-${index+1}`,
    billableSerps:billableSerpsPerTask,
    executeAutomatically:false
  }));
  return {
    provider:'DATAFORSEO_AMAZON_STANDARD',
    endpoint:'/v3/merchant/amazon/products/task_post',
    retrievalEndpoint:'/v3/merchant/amazon/products/task_get/advanced/{id}',
    taskCount:tasks.length,
    billableSerps:tasks.reduce((sum,t)=>sum+t.billableSerps,0),
    maxResultsRequested:tasks.length*normalizedDepth,
    tasks,
    paidExecutionAuthorized:false
  };
}

export function splitAmazonTaskPosts(tasks=[],maxTasksPerPost=100){
  const size=Math.max(1,Math.min(100,Number(maxTasksPerPost)||100));
  const batches=[];
  for(let i=0;i<tasks.length;i+=size)batches.push(tasks.slice(i,i+size));
  return batches;
}

export function estimateAmazonAcquisitionCost(plan,{fxUsdEur=null}={}){
  return estimateProviderCost('DATAFORSEO_AMAZON_STANDARD',{billableUnits:plan?.billableSerps,fxUsdEur});
}

export function authorizeAmazonAcquisition(plan,{explicitApproval=false,budgetRemainingEur=0,fxUsdEur=null}={}){
  return authorizeAcquisitionRun('DATAFORSEO_AMAZON_STANDARD',{
    explicitApproval,
    budgetRemainingEur,
    billableUnits:plan?.billableSerps,
    fxUsdEur
  });
}

export function dataforseoAmazonRequestSpec(batch=[]){
  if(!Array.isArray(batch)||!batch.length)return{valid:false,reason:'TASK_BATCH_REQUIRED'};
  if(batch.length>100)return{valid:false,reason:'MAX_100_TASKS_PER_POST'};
  return {
    valid:true,
    method:'POST',
    baseUrl:'https://api.dataforseo.com',
    path:'/v3/merchant/amazon/products/task_post',
    body:batch.map(({executeAutomatically,billableSerps,...task})=>task),
    requiresSecrets:['DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD'],
    executeAutomatically:false
  };
}

export function acquisitionYieldEstimate(plan,{dedupeRatePct=20}={}){
  const requested=Math.max(0,Number(plan?.maxResultsRequested)||0);
  const dedupe=Math.max(0,Math.min(95,Number(dedupeRatePct)||0));
  return {
    requestedRows:requested,
    assumedDedupeRatePct:dedupe,
    estimatedUniqueUpperBound:Math.floor(requested*(1-dedupe/100)),
    evidenceClass:'PLANNING_ESTIMATE',
    verifiedUniqueProducts:null
  };
}
