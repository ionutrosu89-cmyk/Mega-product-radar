import {amazonSurfaceUrl,alibabaTopRankingUrl,ebayBestSellingRequest} from './public-marketplace-collectors.js';

const text=v=>String(v??'').trim();
const clean=v=>text(v).replace(/^\/+|\/+$/g,'');

const AMAZON_SURFACES=['BEST_SELLERS','NEW_RELEASES','MOVERS_AND_SHAKERS'];
const AMAZON_MARKETS=['US','DE','FR','IT','ES','UK'];

function approvedRows(mappings=[]){
  return (mappings||[]).filter(x=>x?.approved===true&&text(x?.mprCategory));
}

function amazonTasks(rows=[]){
  const tasks=[];const rejected=[];
  for(const row of rows){
    const amazon=row.amazon||{};
    const markets=(amazon.markets||[]).map(x=>text(x).toUpperCase()).filter(x=>AMAZON_MARKETS.includes(x));
    const surfaces=(amazon.surfaces||[]).map(x=>text(x).toUpperCase()).filter(x=>AMAZON_SURFACES.includes(x));
    if(!markets.length||!surfaces.length){rejected.push({mprCategory:row.mprCategory,source:'AMAZON',error:'APPROVED_MAPPING_INCOMPLETE'});continue;}
    for(const market of markets)for(const surface of surfaces){
      const url=amazonSurfaceUrl({market,surface,categoryPath:amazon.categoryPath||''});
      if(!url){rejected.push({mprCategory:row.mprCategory,source:'AMAZON',error:'URL_INVALID'});continue;}
      tasks.push({sourceKey:`AMAZON_${surface}`,platform:'AMAZON',mprCategory:row.mprCategory,market,surface,url,sourceCategoryId:text(amazon.categoryId)||null,expectedMaxRows:100,executeAutomatically:false,paid:false});
    }
  }
  return{tasks,rejected};
}

function alibabaTasks(rows=[]){
  const tasks=[];const rejected=[];
  for(const row of rows){
    const slug=clean(row?.alibaba?.categorySlug);
    if(!slug){rejected.push({mprCategory:row.mprCategory,source:'ALIBABA',error:'APPROVED_MAPPING_INCOMPLETE'});continue;}
    tasks.push({sourceKey:'ALIBABA_TOP_RANKING',platform:'ALIBABA',mprCategory:row.mprCategory,url:alibabaTopRankingUrl({categorySlug:slug}),categorySlug:slug,expectedMaxRows:100,executeAutomatically:false,paid:false});
  }
  return{tasks,rejected};
}

function ebayTasks(rows=[]){
  const tasks=[];const rejected=[];
  for(const row of rows){
    const categoryId=text(row?.ebay?.categoryId);
    if(!categoryId){rejected.push({mprCategory:row.mprCategory,source:'EBAY',error:'APPROVED_MAPPING_INCOMPLETE'});continue;}
    const request=ebayBestSellingRequest({categoryId,marketplaceId:text(row?.ebay?.marketplaceId)||'EBAY_US',limit:100});
    if(!request.ok){rejected.push({mprCategory:row.mprCategory,source:'EBAY',error:request.error});continue;}
    tasks.push({sourceKey:'EBAY_BEST_SELLING',platform:'EBAY',mprCategory:row.mprCategory,request,expectedMaxRows:100,credentialsRequired:true,serverSecretRequired:'EBAY_OAUTH_TOKEN',executeAutomatically:false,paid:false});
  }
  return{tasks,rejected};
}

export function buildPublicSeedRunManifest({categoryMappings=[],include={amazon:true,alibaba:true,ebay:true},maxTasks=500}={}){
  const approved=approvedRows(categoryMappings);
  const rejectedMappings=(categoryMappings||[]).filter(x=>x?.approved!==true).map(x=>({mprCategory:text(x?.mprCategory)||null,error:'MAPPING_NOT_APPROVED'}));
  const parts=[];
  if(include.amazon!==false)parts.push(amazonTasks(approved));
  if(include.alibaba!==false)parts.push(alibabaTasks(approved));
  if(include.ebay!==false)parts.push(ebayTasks(approved));
  const allTasks=parts.flatMap(x=>x.tasks);
  const limit=Math.max(1,Math.min(2000,Number(maxTasks)||500));
  const tasks=allTasks.slice(0,limit);
  const truncated=Math.max(0,allTasks.length-tasks.length);
  const rejected=[...rejectedMappings,...parts.flatMap(x=>x.rejected)];
  const byPlatform={};
  for(const task of tasks)byPlatform[task.platform]=(byPlatform[task.platform]||0)+1;
  return{
    approvedCategoryMappings:approved.length,
    totalCandidateTasks:allTasks.length,
    taskCount:tasks.length,
    truncatedTaskCount:truncated,
    tasks,
    rejected,
    stats:{byPlatform},
    estimatedMaxRows:tasks.reduce((sum,x)=>sum+(x.expectedMaxRows||0),0),
    manualCategoryApprovalRequired:true,
    robotsAndTermsReviewRequired:true,
    rateLimitRequired:true,
    cacheRequired:true,
    credentialsRemainServerSide:true,
    approvedSpendEur:0,
    paidCallsTriggered:0,
    externalExecutionTriggered:false,
    executeAutomatically:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false
  };
}

export function splitSeedRunIntoBatches(manifest={},batchSize=20){
  const tasks=Array.isArray(manifest?.tasks)?manifest.tasks:[];
  const size=Math.max(1,Math.min(100,Number(batchSize)||20));
  const batches=[];
  for(let i=0;i<tasks.length;i+=size){
    const batchTasks=tasks.slice(i,i+size);
    batches.push({batchNumber:batches.length+1,taskCount:batchTasks.length,tasks:batchTasks,requiresManualExecutionApproval:true,paid:false});
  }
  return{batchSize:size,batchCount:batches.length,batches,paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false};
}

export function validateSeedRunForExecution(batch={},credentials={}){
  const tasks=Array.isArray(batch?.tasks)?batch.tasks:[];
  if(!tasks.length)return{ok:false,error:'EMPTY_BATCH'};
  const blockers=[];
  for(const task of tasks){
    if(task.paid===true)blockers.push({sourceKey:task.sourceKey,error:'PAID_TASK_FORBIDDEN'});
    if(task.executeAutomatically===true)blockers.push({sourceKey:task.sourceKey,error:'AUTO_EXECUTION_FORBIDDEN'});
    if(task.credentialsRequired===true&&!credentials?.[task.sourceKey])blockers.push({sourceKey:task.sourceKey,error:'CREDENTIALS_REQUIRED'});
  }
  return{ok:blockers.length===0,blockers,requiresExplicitExecutionApproval:true,approvedSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false};
}
