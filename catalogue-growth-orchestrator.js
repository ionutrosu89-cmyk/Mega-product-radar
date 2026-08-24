const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};

export const CATALOGUE_MILESTONES=Object.freeze([
  {key:'M1_10K',targetProducts:10000,label:'Useful initial catalogue'},
  {key:'M2_50K',targetProducts:50000,label:'Meaningful category rankings'},
  {key:'M3_100K',targetProducts:100000,label:'Serious market intelligence foundation'}
]);

export const CATALOGUE_SOURCE_POLICY=Object.freeze({
  AMAZON_PUBLIC:{mode:'PUBLIC_OR_LICENSED',paid:false,allowedUse:'MARKET_INTELLIGENCE',autoExecute:false},
  KEEPA_LICENSED:{mode:'LICENSED_API',paid:true,allowedUse:'MARKET_INTELLIGENCE',autoExecute:false},
  SELLERSPRITE_LICENSED:{mode:'LICENSED_DATA',paid:true,allowedUse:'MARKET_INTELLIGENCE',autoExecute:false},
  SMARTSCOUT_LICENSED:{mode:'LICENSED_DATA',paid:true,allowedUse:'MARKET_INTELLIGENCE',autoExecute:false},
  EMAG_PUBLIC:{mode:'PUBLIC_EVIDENCE',paid:false,allowedUse:'ROMANIA_MARKET_CONTEXT',autoExecute:false},
  MANUAL_RESEARCH:{mode:'MANUAL_EVIDENCE',paid:false,allowedUse:'INTERNAL_INTELLIGENCE',autoExecute:false}
});

export function catalogueProgress(currentProducts=0){
  const current=Math.max(0,n(currentProducts));
  const next=CATALOGUE_MILESTONES.find(m=>current<m.targetProducts)||null;
  return {
    currentProducts:current,
    nextMilestone:next,
    productsToNext:next?Math.max(0,next.targetProducts-current):0,
    architectureTarget:CATALOGUE_MILESTONES.at(-1).targetProducts,
    architectureProgressPct:Number(Math.min(100,current/CATALOGUE_MILESTONES.at(-1).targetProducts*100).toFixed(2))
  };
}

export function buildCatalogueCoveragePlan({niches=[],currentCounts={},targetProducts=10000,minUsefulPerNiche=25,maxBatchPerNiche=250}={}){
  const clean=[...new Set((niches||[]).map(String).map(x=>x.trim()).filter(Boolean))];
  if(!clean.length)return{targetProducts,plannedProducts:0,tasks:[],policy:'NO_NICHES'};
  const target=Math.max(clean.length*minUsefulPerNiche,n(targetProducts));
  const fairShare=Math.max(minUsefulPerNiche,Math.ceil(target/clean.length));
  const tasks=clean.map(nicheKey=>{
    const current=Math.max(0,n(currentCounts[nicheKey]));
    const gap=Math.max(0,fairShare-current);
    return {
      nicheKey,
      currentProducts:current,
      targetProducts:fairShare,
      gap,
      nextBatch:Math.min(gap,maxBatchPerNiche),
      priority:current<minUsefulPerNiche?'CRITICAL':gap>0?'GROW':'COVERED'
    };
  }).sort((a,b)=>{
    const p={CRITICAL:0,GROW:1,COVERED:2};
    return p[a.priority]-p[b.priority]||b.gap-a.gap||a.nicheKey.localeCompare(b.nicheKey);
  });
  return {
    targetProducts:target,
    fairSharePerNiche:fairShare,
    plannedProducts:tasks.reduce((s,x)=>s+x.nextBatch,0),
    criticalNiches:tasks.filter(x=>x.priority==='CRITICAL').length,
    tasks,
    policy:'BREADTH_FIRST_BEFORE_DEEP_ENRICHMENT'
  };
}

export function authorizeCatalogueSource(sourceKey,{explicitPaidApproval=false,monthlyBudgetRemainingEur=0,estimatedCostEur=0}={}){
  const policy=CATALOGUE_SOURCE_POLICY[sourceKey];
  if(!policy)return{authorized:false,reason:'UNKNOWN_SOURCE'};
  if(policy.autoExecute===true)return{authorized:false,reason:'POLICY_INVALID_AUTO_EXECUTION'};
  if(!policy.paid)return{authorized:true,reason:'ZERO_COST_SOURCE_ALLOWED_FOR_PLANNING',executeAutomatically:false};
  if(!explicitPaidApproval)return{authorized:false,reason:'PAID_APPROVAL_REQUIRED'};
  if(n(estimatedCostEur)<=0)return{authorized:false,reason:'PAID_COST_ESTIMATE_REQUIRED'};
  if(n(estimatedCostEur)>n(monthlyBudgetRemainingEur))return{authorized:false,reason:'BUDGET_INSUFFICIENT'};
  return{authorized:true,reason:'PAID_SOURCE_APPROVED_WITHIN_BUDGET',executeAutomatically:false};
}

export function catalogueGrowthDashboard({currentProducts=0,niches=[],currentCounts={}}={}){
  const progress=catalogueProgress(currentProducts);
  const coverage=buildCatalogueCoveragePlan({niches,currentCounts,targetProducts:progress.nextMilestone?.targetProducts||progress.architectureTarget});
  return {
    progress,
    coverage,
    dataStrategy:'BROAD_CATALOGUE_THEN_INFORMATION_VALUE_ENRICHMENT',
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}
