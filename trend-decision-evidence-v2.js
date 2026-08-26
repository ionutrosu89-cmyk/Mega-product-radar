const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));

export function buildTrendDecisionEvidence(analysis={}){
  const canonicalProductId=analysis.canonicalProductId||null;
  const status=String(analysis.status||'INSUFFICIENT_HISTORY');
  const trendScore=Number.isFinite(Number(analysis.trendScore))?clamp(analysis.trendScore):null;
  const confidence=clamp(analysis.confidence);
  const persistent=status==='PERSISTENT_TREND';
  const emerging=status==='EMERGING_TREND';
  const spike=status==='SPIKE_OR_REVERSAL';
  const decisionEligible=Boolean(canonicalProductId&&analysis.decisionEligible!==false);

  let gateStatus='UNKNOWN';
  let maximumContribution='DISCOVERED_SUPPORT_ONLY';
  const reasons=[];

  if(!decisionEligible){reasons.push('CANONICAL_PRODUCT_ID_REQUIRED');}
  else if(status==='INSUFFICIENT_HISTORY'){reasons.push('INSUFFICIENT_LONGITUDINAL_HISTORY');}
  else if(spike){gateStatus='REVIEW';maximumContribution='PROMISING_SUPPORT_ONLY';reasons.push('SPIKE_IS_NOT_PERSISTENT_TREND');}
  else if(persistent&&confidence>=60&&trendScore!==null&&trendScore>=60){gateStatus='PASS';maximumContribution='VALIDATE_SUPPORT_ONLY';reasons.push('PERSISTENT_MULTI_WINDOW_SUPPORT');}
  else if(emerging&&confidence>=45&&trendScore!==null&&trendScore>=60){gateStatus='REVIEW';maximumContribution='PROMISING_SUPPORT_ONLY';reasons.push('EMERGING_NOT_YET_PERSISTENT');}
  else {gateStatus='REVIEW';maximumContribution='PROMISING_SUPPORT_ONLY';reasons.push('TREND_EVIDENCE_NOT_STRONG_ENOUGH_FOR_PASS');}

  return Object.freeze({
    schemaVersion:'MPR_TREND_DECISION_EVIDENCE_V2',canonicalProductId,gateStatus,maximumContribution,trendStatus:status,trendScore,confidence,decisionEligible,
    reasons:Object.freeze(reasons),evidenceClass:'DERIVED',salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null,
    canPromoteToFinalist:false,canPromoteToTestReady:false,canPromoteToBuyReady:false,autoPromoteOpportunityStage:false,purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'TREND_CAN_SUPPORT_DISCOVERY_PROMISING_VALIDATE_ONLY; FINALIST_TEST_BUY_REQUIRE_CANONICAL_DECISION_AUTHORITY_AND_OTHER_GATES'
  });
}
