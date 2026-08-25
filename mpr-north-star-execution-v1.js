const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
const state=(status,reason,metrics={})=>({status,reason,metrics});

export const MPR_NORTH_STAR_TASKS=Object.freeze([
  'DATA_FOUNDATION','TREND_INTELLIGENCE','ROMANIA_GAP','SUPPLIER_INTELLIGENCE','ECONOMICS','OPPORTUNITY_ENGINE','RADAR','LAUNCH','ONBOARDING','SCALE'
]);

export function evaluateNorthStarExecution({
  productUniverse={},amazonRound2={},trend={},romania={},supplier={},economics={},opportunity={},radar={},launch={},onboarding={},scale={}
}={}){
  const unique=n(productUniverse.uniqueProducts);
  const live=n(productUniverse.liveObservedProducts);
  const round2Eligible=n(amazonRound2.eligibleCount);
  const longitudinal=n(trend.longitudinalProducts);
  const comparableLocal=n(romania.comparableReadyNiches);
  const verifiedQuotes=n(supplier.verifiedQuotes);
  const confirmedLanded=n(economics.confirmedLandedProducts);
  const finalists=Math.min(3,n(opportunity.finalists));
  const alerts=n(radar.strictAlerts);
  const launchModules=n(launch.completedOperationalModules);
  const planFinderAligned=onboarding.planFinderAligned===true;
  const target=n(scale.nextTarget||10000);

  const tasks={};
  tasks.DATA_FOUNDATION=unique>=10000
    ?state('READY','10K_PRODUCT_UNIVERSE_REACHED',{unique,live})
    :state('IN_PROGRESS','GROW_PRODUCT_UNIVERSE_AND_LONGITUDINAL_COVERAGE',{unique,live,round2Eligible,nextTarget:10000});

  tasks.TREND_INTELLIGENCE=longitudinal>0
    ?state('IN_PROGRESS','REAL_LONGITUDINAL_SIGNALS_AVAILABLE_BUT_COVERAGE_MUST_GROW',{longitudinal})
    :state('BLOCKED','NEEDS_SECOND_PUBLIC_OBSERVATION_AT_LEAST_24H_APART',{longitudinal,round2Eligible});

  tasks.ROMANIA_GAP=comparableLocal>0
    ?state('IN_PROGRESS','AT_LEAST_ONE_COMPARABLE_LOCAL_SCOPE_READY',{comparableReadyNiches:comparableLocal})
    :state('BLOCKED','NEEDS_EXACT_COMPARABLE_EMAG_AND_TRENDYOL_SCOPE',{comparableReadyNiches:0,lowerBoundsAreNotExact:true});

  tasks.SUPPLIER_INTELLIGENCE=verifiedQuotes>=3
    ?state('IN_PROGRESS','VERIFIED_QUOTES_EXIST_GROW_TO_3_PER_PRODUCT',{verifiedQuotes})
    :state('IN_PROGRESS','PUBLIC_SUPPLIER_CANDIDATES_EXIST_BUT_VERIFIED_QUOTES_ARE_SPARSE',{verifiedQuotes});

  tasks.ECONOMICS=confirmedLanded>0
    ?state('IN_PROGRESS','CONFIRMED_LANDED_ECONOMICS_EXIST_FOR_SOME_PRODUCTS',{confirmedLanded})
    :state('BLOCKED','NO_CONFIRMED_LANDED_COST_NO_CONFIRMED_PROFIT',{confirmedLanded});

  tasks.OPPORTUNITY_ENGINE=state('READY','V4_FUNNEL_AND_FINALIST_CAP_IMPLEMENTED',{finalists,maxFinalists:3,purchaseAuthorized:false});

  tasks.RADAR=longitudinal>0&&comparableLocal>0
    ?state('IN_PROGRESS','STRICT_ALERT_INPUTS_EXIST',{strictAlerts:alerts})
    :state('BLOCKED','RADAR_MUST_WAIT_FOR_STRICT_TREND_AND_ROMANIA_GAP_INPUTS',{strictAlerts:alerts});

  tasks.LAUNCH=state(launchModules>=10?'READY':'IN_PROGRESS','LAUNCH_ACADEMY_AND_EXECUTION_PATH_EXIST_PARTNER_NETWORK_REQUIRES_REAL_VERIFICATION',{completedOperationalModules:launchModules,chinaAgentAccess:launch.chinaAgentAccess===true});

  tasks.ONBOARDING=planFinderAligned
    ?state('READY','FREE_DISCOVER_RADAR_LAUNCH_RECOMMENDATION_ALIGNED',{planFinderAligned:true})
    :state('BLOCKED','PLAN_RECOMMENDATION_DOES_NOT_MATCH_PRODUCT_TIERS',{planFinderAligned:false});

  const scaleStatus=unique>=100000?'READY':'IN_PROGRESS';
  tasks.SCALE=state(scaleStatus,'STAGED_SCALE_ONLY_NO_PREMATURE_500K_JUMP',{current:unique,nextTarget:target,sequence:[1000,10000,50000,100000,500000],paidExecutionAutomatic:false});

  const counts={READY:0,IN_PROGRESS:0,BLOCKED:0};
  for(const value of Object.values(tasks))counts[value.status]=(counts[value.status]||0)+1;
  return {
    version:'1.0',
    principle:'DATA -> INTELLIGENCE -> DECISION -> EXECUTION',
    tasks,
    counts,
    allTaskNamesPresent:MPR_NORTH_STAR_TASKS.every(k=>Boolean(tasks[k])),
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false,
    policy:'EVIDENCE_GATES_FAIL_CLOSED; STATUS_IS_NOT_A_CLAIM_OF_MARKET_SUCCESS'
  };
}

export function nextScaleMilestone(currentUniqueProducts=0){
  const current=Math.max(0,Math.floor(n(currentUniqueProducts)));
  const milestones=[1000,10000,50000,100000,500000,1000000];
  return milestones.find(x=>x>current)||1000000;
}
