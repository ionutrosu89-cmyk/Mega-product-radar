const pct=(n,d)=>d>0?Number(((n/d)*100).toFixed(2)):0;

export const P2_SCALE_ENTRY_TARGETS=Object.freeze({
  minCanonicalProductsBeforeScale:1000,
  minSourceIdentityCoveragePct:70,
  minPriceCoveragePct:60,
  minReviewCoveragePct:60,
  minCategoryCoveragePct:90,
  maxUnboundObservationPct:20
});

export const P2_10K_MILESTONE_TARGETS=Object.freeze({
  targetCanonicalProducts:10000,
  minTwoPlusObservations:3000,
  minThreePlusObservations:1000
});

export const P2_10K_QUALITY_TARGETS=Object.freeze({...P2_SCALE_ENTRY_TARGETS,...P2_10K_MILESTONE_TARGETS});

export function buildDataQualityReport(universe={},historyReport={},targets=P2_10K_QUALITY_TARGETS){
  const rows=Array.isArray(universe.products)?universe.products:[];
  const metrics=universe.metrics||{};
  const canonicalProducts=Number(metrics.canonicalProducts??rows.length)||0;
  const twoPlus=rows.filter(x=>Number(x.observationCount)>=2).length;
  const threePlus=rows.filter(x=>Number(x.observationCount)>=3).length;
  const bound=Number(metrics.boundObservations)||0,unbound=Number(metrics.unboundObservations)||0,totalObs=bound+unbound;
  const unboundPct=pct(unbound,totalObs);
  const entryChecks=[
    ['CANONICAL_BASELINE',canonicalProducts>=targets.minCanonicalProductsBeforeScale,canonicalProducts,targets.minCanonicalProductsBeforeScale],
    ['SOURCE_IDENTITY_COVERAGE',Number(metrics.sourceIdentityCoveragePct)>=targets.minSourceIdentityCoveragePct,Number(metrics.sourceIdentityCoveragePct)||0,targets.minSourceIdentityCoveragePct],
    ['PRICE_COVERAGE',Number(metrics.priceCoveragePct)>=targets.minPriceCoveragePct,Number(metrics.priceCoveragePct)||0,targets.minPriceCoveragePct],
    ['REVIEW_COVERAGE',Number(metrics.reviewCoveragePct)>=targets.minReviewCoveragePct,Number(metrics.reviewCoveragePct)||0,targets.minReviewCoveragePct],
    ['CATEGORY_COVERAGE',Number(metrics.categoryCoveragePct)>=targets.minCategoryCoveragePct,Number(metrics.categoryCoveragePct)||0,targets.minCategoryCoveragePct],
    ['UNBOUND_OBSERVATIONS',unboundPct<=targets.maxUnboundObservationPct,unboundPct,targets.maxUnboundObservationPct]
  ].map(([code,passed,value,target])=>({code,passed,value,target,gate:'SCALE_ENTRY'}));
  const milestoneChecks=[
    ['TEN_K_CANONICAL_PRODUCTS',canonicalProducts>=targets.targetCanonicalProducts,canonicalProducts,targets.targetCanonicalProducts],
    ['TWO_PLUS_HISTORY',twoPlus>=targets.minTwoPlusObservations,twoPlus,targets.minTwoPlusObservations],
    ['THREE_PLUS_HISTORY',threePlus>=targets.minThreePlusObservations,threePlus,targets.minThreePlusObservations]
  ].map(([code,passed,value,target])=>({code,passed,value,target,gate:'TEN_K_MILESTONE'}));
  const blockers=entryChecks.filter(x=>!x.passed).map(x=>x.code);
  const milestoneGaps=milestoneChecks.filter(x=>!x.passed).map(x=>x.code);
  const scaleAuthorized=blockers.length===0;
  const tenKMilestoneReached=milestoneGaps.length===0;
  return Object.freeze({
    schemaVersion:'MPR_DATA_QUALITY_REPORT_V2',
    status:!scaleAuthorized?'HOLD_SCALE':tenKMilestoneReached?'TEN_K_MILESTONE_REACHED':'READY_FOR_CONTROLLED_SCALE',
    checks:Object.freeze([...entryChecks,...milestoneChecks]),entryChecks:Object.freeze(entryChecks),milestoneChecks:Object.freeze(milestoneChecks),blockers:Object.freeze(blockers),milestoneGaps:Object.freeze(milestoneGaps),
    metrics:{canonicalProducts,twoPlusObservations:twoPlus,threePlusObservations:threePlus,boundObservations:bound,unboundObservations:unbound,unboundObservationPct:unboundPct,longitudinalReadySeries:Number(historyReport.longitudinalReady)||0,decisionEligibleSeries:Number(historyReport.decisionEligibleSeries)||0},
    scaleAuthorized,tenKMilestoneReached,automaticPaidExpansionAllowed:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false,
    policy:'QUALITY_BEFORE_VOLUME; SCALE_ENTRY_GATES_ARE_SEPARATE_FROM_10K_MILESTONE_TARGETS; TARGETS_ARE MANAGEMENT_GATES_NOT CLAIMS_OF CURRENT COVERAGE'
  });
}
