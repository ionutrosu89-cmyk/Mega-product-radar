import {calculateOpportunityV3} from './opportunity-engine-v3.js';

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const bool=v=>v===true;
const up=v=>String(v??'').trim().toUpperCase();

function supplierVerified(s={}){
  return bool(s.verifiedQuote)||up(s.evidenceClass)==='MANUALLY_VERIFIED'||up(s.verificationStatus)==='SUPPLIER_OK';
}
function economicsConfirmed(e={}){
  const margin=n(e.marginPct),roi=n(e.roiPct),profit=n(e.profitPerUnit);
  return bool(e.landedCostConfirmed)&&margin!==null&&roi!==null&&profit!==null&&margin>0&&roi>0&&profit>0;
}
function romaniaEvidenceState(input={}){
  const gap=input.romaniaGap||{};
  const sampled=input.romaniaSampledCompetition||input.sampledRomaniaCompetition||{};
  const sampledEligible=sampled.eligibleForSampledSignal===true||['SINGLE_PLATFORM_ESTIMATE','MULTI_PLATFORM_ESTIMATE'].includes(up(sampled.status))||up(sampled.evidenceClass).includes('DERIVED');
  const explicitlyNonExact=gap.romaniaGapExactGateSatisfied===false||gap.exactComparableCount===false||['DERIVED_ESTIMATE','DERIVED_FROM_REVIEWED_PUBLIC_SAMPLE','SAMPLED_ESTIMATE'].includes(up(gap.evidenceClass));
  const explicitlyExact=gap.romaniaGapExactGateSatisfied===true||gap.exactComparableCount===true;
  const legacyReadyWithoutEstimateMarkers=gap.status==='READY'&&!sampledEligible&&!explicitlyNonExact;
  const exactReady=gap.status==='READY'&&(explicitlyExact||legacyReadyWithoutEstimateMarkers);
  return {
    exactReady,
    sampledEligible,
    evidenceClass:exactReady?'EXACT_COMPARABLE_LOCAL_EVIDENCE':sampledEligible?'DERIVED_SAMPLED_LOCAL_EVIDENCE':'UNKNOWN',
    maxFunnelStage:exactReady?'TEST_READY':sampledEligible?'PROMISING':'DISCOVERED'
  };
}

export function calculateOpportunityV4(input={}){
  const base=calculateOpportunityV3(input);
  const marketReady=base.status==='READY';
  const supplierReady=supplierVerified(input.supplier);
  const economicsReady=economicsConfirmed(input.economics);
  const evidenceConfidence=n(input.dataConfidence??input.confidence);
  const romaniaEvidence=romaniaEvidenceState(input);
  const blockers=[...(base.blockers||[])];

  let funnelStage='DISCOVERED';
  if(marketReady&&base.marketOpportunityScore>=50)funnelStage='PROMISING';
  if(marketReady&&base.marketOpportunityScore>=65&&(evidenceConfidence===null||evidenceConfidence>=50))funnelStage='VALIDATE';
  if(marketReady&&base.marketOpportunityScore>=65&&supplierReady&&economicsReady&&(evidenceConfidence===null||evidenceConfidence>=60))funnelStage='FINALIST';
  if(funnelStage==='FINALIST'&&bool(input.testGateReady)&&bool(input.complianceGateReady))funnelStage='TEST_READY';

  if(!romaniaEvidence.exactReady&&['VALIDATE','FINALIST','TEST_READY'].includes(funnelStage)){
    funnelStage=romaniaEvidence.sampledEligible?'PROMISING':'DISCOVERED';
    blockers.push('ROMANIA_EXACT_EVIDENCE_REQUIRED_FOR_VALIDATION');
  }
  if(romaniaEvidence.sampledEligible&&!romaniaEvidence.exactReady)blockers.push('ROMANIA_SAMPLED_EVIDENCE_PRELIMINARY_ONLY');

  if(['FINALIST','TEST_READY'].includes(funnelStage)&&!supplierReady)blockers.push('VERIFIED_SUPPLIER_MISSING');
  if(['FINALIST','TEST_READY'].includes(funnelStage)&&!economicsReady)blockers.push('CONFIRMED_ECONOMICS_MISSING');
  if(funnelStage==='TEST_READY'&&!bool(input.testGateReady))blockers.push('TEST_GATE_MISSING');
  if(funnelStage==='TEST_READY'&&!bool(input.complianceGateReady))blockers.push('COMPLIANCE_GATE_MISSING');

  return {
    ...base,
    version:'4.1',
    funnelStage,
    supplierReady,
    economicsReady,
    dataConfidence:evidenceConfidence,
    romaniaEvidence,
    blockers:[...new Set(blockers)],
    nextAction:funnelStage==='DISCOVERED'?'COLLECT_MARKET_EVIDENCE':funnelStage==='PROMISING'?'VALIDATE_ROMANIA_EXACT_EVIDENCE_AND_SUPPLIER':funnelStage==='VALIDATE'?'VERIFY_SUPPLIER_AND_ECONOMICS':funnelStage==='FINALIST'?'PREPARE_MEASURED_TEST':'RUN_MEASURED_TEST_ONLY_AFTER_EXPLICIT_USER_ACTION',
    policy:'DATA_TO_INTELLIGENCE_TO_DECISION; SAMPLED_ROMANIA_MAX_PROMISING; EXACT_ROMANIA_REQUIRED_FROM_VALIDATE; FINALIST_MAX_3; TEST_READY_IS_NOT_BUY_READY; UNKNOWN_IS_NOT_ZERO; NO_AUTO_PURCHASE',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false
  };
}

export function buildOpportunityShortlistV4(rows=[],maxFinalists=3){
  const evaluated=(rows||[]).map(row=>({productKey:row.productKey||row.identity||null,title:row.title||row.name||null,...calculateOpportunityV4(row)}));
  const priority={TEST_READY:5,FINALIST:4,VALIDATE:3,PROMISING:2,DISCOVERED:1};
  evaluated.sort((a,b)=>(priority[b.funnelStage]||0)-(priority[a.funnelStage]||0)||(b.marketOpportunityScore??-1)-(a.marketOpportunityScore??-1)||(b.commercialMaturityScore??-1)-(a.commercialMaturityScore??-1));
  const cap=Math.max(1,Math.min(3,Math.floor(Number(maxFinalists)||3)));
  let finalistsSeen=0;
  const rowsOut=evaluated.map(x=>{
    if(!['FINALIST','TEST_READY'].includes(x.funnelStage))return x;
    finalistsSeen++;
    if(finalistsSeen<=cap)return x;
    return {...x,funnelStage:'VALIDATE',nextAction:'FINALIST_CAP_REACHED_REVIEW_EXISTING_SHORTLIST',blockers:[...new Set([...(x.blockers||[]),'FINALIST_CAP_REACHED'])]};
  });
  return {
    total:rowsOut.length,
    finalists:rowsOut.filter(x=>['FINALIST','TEST_READY'].includes(x.funnelStage)).length,
    validate:rowsOut.filter(x=>x.funnelStage==='VALIDATE').length,
    promising:rowsOut.filter(x=>x.funnelStage==='PROMISING').length,
    rows:rowsOut,
    maxFinalists:cap,
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}
