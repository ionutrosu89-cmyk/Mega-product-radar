const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const pct=(a,b)=>b>0?Math.round((a/b)*1000)/10:0;

export const FIRST_FINALIST_KPIS=[
  'productsWithTwoLiveSnapshots',
  'productsWithConfirmedTrendFusion',
  'nichesWithExactRomaniaGap',
  'productsWithVerifiedSupplierPackage',
  'productsWithConfirmedLandedEconomics',
  'promisingProducts',
  'validateProducts',
  'finalistProducts'
];

export function buildFirstFinalistProgram(state={}){
  const universe=n(state.productUniverse)||0;
  const firstLive=n(state.productsWithFirstLiveSnapshot)||0;
  const twoLive=n(state.productsWithTwoLiveSnapshots)||0;
  const trend=n(state.productsWithConfirmedTrendFusion)||0;
  const ro=n(state.nichesWithExactRomaniaGap)||0;
  const supplier=n(state.productsWithVerifiedSupplierPackage)||0;
  const economics=n(state.productsWithConfirmedLandedEconomics)||0;
  const promising=n(state.promisingProducts)||0;
  const validate=n(state.validateProducts)||0;
  const finalist=n(state.finalistProducts)||0;
  const testReady=n(state.testReadyProducts)||0;
  const paidCalls=n(state.paidCallsTriggered)||0;
  const spend=n(state.approvedSpendEur)||0;

  const gates={
    DATA_LONGITUDINAL:twoLive>0,
    TREND_FUSION:trend>0,
    ROMANIA_EXACT:ro>0,
    SUPPLIER_VERIFIED:supplier>0,
    ECONOMICS_CONFIRMED:economics>0,
    FIRST_PROMISING:promising>0,
    FIRST_VALIDATE:validate>0,
    FIRST_FINALIST:finalist>0
  };

  const orderedBlockers=[];
  if(!gates.DATA_LONGITUDINAL)orderedBlockers.push('SECOND_LIVE_OBSERVATION_REQUIRED');
  if(!gates.TREND_FUSION)orderedBlockers.push('CONFIRMED_RANK_PLUS_REVIEW_TREND_REQUIRED');
  if(!gates.ROMANIA_EXACT)orderedBlockers.push('FIRST_EXACT_COMPARABLE_ROMANIA_GAP_REQUIRED');
  if(!gates.SUPPLIER_VERIFIED)orderedBlockers.push('THREE_COMPLETE_QUOTES_AND_ONE_MANUALLY_VERIFIED_REQUIRED');
  if(!gates.ECONOMICS_CONFIRMED)orderedBlockers.push('CONFIRMED_LANDED_COST_AND_ECONOMICS_REQUIRED');

  let phase='FIRST_FINALIST';
  let nextAction='REVIEW_FINALIST_FOR_TEST_READINESS';
  if(finalist===0){
    if(twoLive===0){phase='DATA_LONGITUDINAL';nextAction='EXECUTE_AMAZON_ROUND2_AFTER_ELIGIBILITY';}
    else if(trend===0){phase='TREND_FUSION';nextAction='COLLECT_SECOND_PUBLIC_RANK_SNAPSHOT_AND_FUSE_WITH_REVIEWS';}
    else if(ro===0){phase='ROMANIA_EXACT';nextAction='VALIDATE_FIRST_EXACT_EMAG_PLUS_TRENDYOL_NICHE';}
    else if(supplier===0){phase='SUPPLIER_VERIFICATION';nextAction='OBTAIN_THREE_COMPLETE_COMPARABLE_QUOTES';}
    else if(economics===0){phase='CONFIRMED_ECONOMICS';nextAction='CONFIRM_LANDED_COST_AND_PROFIT_ECONOMICS';}
    else if(validate===0){phase='OPPORTUNITY_VALIDATION';nextAction='RERUN_OPPORTUNITY_V4_WITH_COMPLETE_EVIDENCE';}
    else {phase='FINALIST_SELECTION';nextAction='RERUN_SHORTLIST_AND_SELECT_MAX_THREE_FINALISTS';}
  }

  const evidenceCompletion=Math.round((Object.values(gates).filter(Boolean).length/Object.keys(gates).length)*100);
  return {
    version:'1.0',
    objective:'FIRST_REAL_LEGITIMATE_FINALIST',
    phase,
    nextAction,
    metrics:{
      productUniverse:universe,
      productsWithFirstLiveSnapshot:firstLive,
      firstLiveCoveragePct:pct(firstLive,universe),
      productsWithTwoLiveSnapshots:twoLive,
      productsWithConfirmedTrendFusion:trend,
      nichesWithExactRomaniaGap:ro,
      productsWithVerifiedSupplierPackage:supplier,
      productsWithConfirmedLandedEconomics:economics,
      promisingProducts:promising,
      validateProducts:validate,
      finalistProducts:finalist,
      testReadyProducts:testReady
    },
    gates,
    evidenceCompletionPct:evidenceCompletion,
    blockers:orderedBlockers,
    operatingRules:[
      'DATA_BEFORE_SCORING',
      'UNKNOWN_IS_NOT_ZERO',
      'REVIEW_GROWTH_IS_NOT_VERIFIED_SALES',
      'PUBLIC_RANK_IS_NOT_VERIFIED_SALES',
      'SAMPLED_ROMANIA_MAX_PROMISING',
      'FINALIST_REQUIRES_CONFIRMED_TREND_EXACT_ROMANIA_VERIFIED_SUPPLIER_CONFIRMED_ECONOMICS',
      'MAX_THREE_FINALISTS',
      'TEST_READY_IS_NOT_BUY_READY',
      'NO_AUTO_PURCHASE',
      'NO_PAID_PROVIDER_WITHOUT_EXPLICIT_APPROVAL'
    ],
    scaleGate:{currentUniverse:universe,nextTarget:universe<10000?10000:universe<50000?50000:universe<100000?100000:universe<500000?500000:1000000,scaleNow:finalist>0,reason:finalist>0?'FIRST_FINALIST_PROVEN_SCALE_BREADTH':'PROVE_FIRST_FINALIST_BEFORE_MAJOR_SCALE'},
    spend:{paidCallsTriggered:paidCalls,approvedSpendEur:spend},
    purchaseAuthorized:false
  };
}
