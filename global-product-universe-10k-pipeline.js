import {buildUniverseMilestoneStatus} from './global-product-universe-seeder.js';
import {MARKETPLACE_SOURCE_EXPANSION,buildSourceExpansionPlan} from './marketplace-source-expansion.js';

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const DEFAULT_10K_TARGET=10000;
export const DEFAULT_FREE_FIRST_BUDGET_EUR=0;

// The 10K Product Universe is demand/catalogue breadth. Alibaba is intentionally
// excluded from this allocation because it is SUPPLY_DISCOVERY, not demand ranking.
// Alibaba remains available to Supplier Intelligence through the source registry.
const SOURCE_WEIGHTS=Object.freeze({
  AMAZON_PUBLIC_RANKINGS:55,
  EBAY_BEST_SELLING:15,
  ETSY_OPEN_API:15,
  WALMART_CATALOG_SEARCH:15
});

function normalizeCounts(counts={}){
  const out={};
  for(const key of Object.keys(SOURCE_WEIGHTS))out[key]=Math.max(0,Math.floor(n(counts?.[key])));
  return out;
}

function allocationForRemaining(remaining,weights=SOURCE_WEIGHTS){
  const totalWeight=Object.values(weights).reduce((a,b)=>a+b,0)||1;
  const rows=[];
  let assigned=0;
  const keys=Object.keys(weights);
  keys.forEach((sourceKey,index)=>{
    const raw=remaining*(weights[sourceKey]/totalWeight);
    const target=index===keys.length-1?Math.max(0,remaining-assigned):Math.floor(raw);
    assigned+=target;
    rows.push({sourceKey,targetNewUniqueProducts:target});
  });
  return rows;
}

function sourceReadiness(sourceKey,credentials={}){
  const source=MARKETPLACE_SOURCE_EXPANSION[sourceKey];
  if(!source)return{sourceKey,ready:false,reason:'UNKNOWN_SOURCE'};
  if(source.role==='RESEARCH_ONLY')return{sourceKey,ready:false,reason:'RESEARCH_ONLY'};
  if(source.paid===true)return{sourceKey,ready:false,reason:'PAID_SOURCE_NOT_ALLOWED'};
  if(source.credentialsRequired===true&&!credentials?.[sourceKey])return{sourceKey,ready:false,reason:'CREDENTIALS_REQUIRED'};
  return{sourceKey,ready:true,reason:'READY_FREE_SOURCE'};
}

export function build10kAcquisitionPlan({
  currentUniqueProducts=0,
  countsBySource={},
  credentials={},
  target=DEFAULT_10K_TARGET,
  approvedSpendEur=DEFAULT_FREE_FIRST_BUDGET_EUR
}={}){
  const goal=Math.max(1,Math.floor(n(target)||DEFAULT_10K_TARGET));
  const current=Math.max(0,Math.floor(n(currentUniqueProducts)));
  const remaining=Math.max(0,goal-current);
  const sourcePlan=buildSourceExpansionPlan({rankingTargetPct:70,catalogueTargetPct:30});
  const counts=normalizeCounts(countsBySource);
  const allocation=allocationForRemaining(remaining).map(row=>{
    const readiness=sourceReadiness(row.sourceKey,credentials);
    const source=MARKETPLACE_SOURCE_EXPANSION[row.sourceKey];
    return{
      ...row,
      platform:source?.platform||null,
      role:source?.role||null,
      currentUniqueProducts:counts[row.sourceKey]||0,
      ready:readiness.ready,
      blockedReason:readiness.ready?null:readiness.reason,
      executeAutomatically:false,
      paid:false
    };
  });
  const budget=Math.max(0,n(approvedSpendEur));
  const freeFirst=budget===0;
  return{
    target:goal,currentUniqueProducts:current,remaining,
    milestone:buildUniverseMilestoneStatus({uniqueProductObservationCount:current},[1000,5000,10000]),
    allocation,
    readySources:allocation.filter(x=>x.ready).map(x=>x.sourceKey),
    blockedSources:allocation.filter(x=>!x.ready).map(x=>({sourceKey:x.sourceKey,reason:x.blockedReason})),
    acquisitionMix:sourcePlan.allocation,
    supplyDiscoverySources:['ALIBABA_TOP_RANKING'],
    supplyDiscoveryCountsTowardDemandTarget:false,
    freeFirstBudgetEur:DEFAULT_FREE_FIRST_BUDGET_EUR,
    approvedSpendEur:budget,
    freeFirst,
    paidProviderExecutionAllowed:false,
    externalExecutionTriggered:false,
    executeAutomatically:false,
    salesPolicy:'PUBLIC_RANKINGS_ARE_NOT_VERIFIED_SALES',
    canonicalizationPolicy:'SOURCE_ID_DEDUPE_ONLY_CROSS_PLATFORM_REQUIRES_REVIEW',
    purchaseAuthorized:false
  };
}

export function evaluateAcquisitionBatch({beforeUniqueProducts=0,afterSeedResult={},plannedNewUniqueProducts=0,sourceKey=null}={}){
  const before=Math.max(0,Math.floor(n(beforeUniqueProducts)));
  const after=Math.max(before,Math.floor(n(afterSeedResult?.uniqueProductObservationCount)));
  const added=Math.max(0,after-before);
  const planned=Math.max(0,Math.floor(n(plannedNewUniqueProducts)));
  const yieldPct=planned>0?Number(clamp(added/planned*100).toFixed(1)):null;
  return{
    sourceKey,
    beforeUniqueProducts:before,
    afterUniqueProducts:after,
    addedUniqueProducts:added,
    plannedNewUniqueProducts:planned,
    yieldPct,
    duplicateObservationCount:Math.max(0,Math.floor(n(afterSeedResult?.duplicateObservationCount))),
    rejectedCount:Math.max(0,Math.floor(n(afterSeedResult?.rejectedCount))),
    crossPlatformReviewCount:Array.isArray(afterSeedResult?.crossPlatformReview)?afterSeedResult.crossPlatformReview.length:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false
  };
}

export function build10kProgressDashboard({seedResult={},countsBySource={},credentials={},target=DEFAULT_10K_TARGET}={}){
  const current=Math.max(0,Math.floor(n(seedResult?.uniqueProductObservationCount)));
  const plan=build10kAcquisitionPlan({currentUniqueProducts:current,countsBySource,credentials,target,approvedSpendEur:0});
  const pct=Number(clamp(current/plan.target*100).toFixed(1));
  return{
    target:plan.target,current,remaining:plan.remaining,progressPct:pct,
    nextMilestone:plan.milestone.next,
    sourceCoverage:normalizeCounts(countsBySource),
    readySources:plan.readySources,
    blockedSources:plan.blockedSources,
    status:current>=plan.target?'TARGET_REACHED':current>=5000?'SCALE_TO_10K':current>=1000?'SCALE_TO_5K':'SCALE_TO_1K',
    freeFirst:true,approvedSpendEur:0,paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false
  };
}
