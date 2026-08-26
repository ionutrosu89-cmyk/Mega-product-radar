const text=v=>String(v??'').trim();

export function buildFirstFinalistDecision({candidateAsin,trendFusion={},romaniaEvidence={},supplierEvidence={},economicsEvidence={}}={}){
  const asin=text(candidateAsin).toUpperCase();
  const trendRow=(trendFusion.rows||[]).find(r=>text(r.externalId).toUpperCase()===asin);
  const trendConfirmed=!!trendRow&&trendRow.confirmedAcceleration===true&&trendRow.status==='CONFIRMED_ACCELERATION';
  const sameRomaniaCandidate=text(romaniaEvidence.candidateAsin).toUpperCase()===asin;
  const romaniaGapConfirmed=sameRomaniaCandidate&&romaniaEvidence.promotion?.exactRomaniaGapConfirmed===true&&romaniaEvidence.promotion?.promotionEligible===true;
  const supplierVerified=Number(supplierEvidence.productsWithManuallyVerifiedSupplier||0)>0;
  const economicsConfirmed=Number(economicsEvidence.productsWithConfirmedLandedEconomics||0)>0;
  const purchaseAuthorized=false;

  const gates={trendConfirmed,romaniaGapConfirmed,supplierVerified,economicsConfirmed};
  const passed=Object.values(gates).filter(Boolean).length;
  let status='BLOCKED_BEFORE_VALIDATE';
  if(trendConfirmed&&romaniaGapConfirmed) status='VALIDATE_SUPPORT_READY';
  if(trendConfirmed&&romaniaGapConfirmed&&supplierVerified&&economicsConfirmed) status='FINALIST_EVIDENCE_READY';

  const blockers=[];
  if(!trendConfirmed) blockers.push('CONFIRMED_TREND_FUSION_MISSING');
  if(!romaniaGapConfirmed) blockers.push('EXACT_ROMANIA_GAP_MISSING');
  if(!supplierVerified) blockers.push('MANUALLY_VERIFIED_SUPPLIER_MISSING');
  if(!economicsConfirmed) blockers.push('CONFIRMED_LANDED_ECONOMICS_MISSING');

  return {
    schemaVersion:'MPR_FIRST_FINALIST_DECISION_V1',candidateAsin:asin||null,status,
    gatesPassed:passed,gatesTotal:4,gates,blockers,
    validateEligible:trendConfirmed&&romaniaGapConfirmed,
    finalistEvidenceReady:trendConfirmed&&romaniaGapConfirmed&&supplierVerified&&economicsConfirmed,
    testReady:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized,
    policy:'FAIL_CLOSED; SAME_ASIN_TREND_AND_ROMANIA; MANUAL_SUPPLIER_REQUIRED; CONFIRMED_LANDED_ECONOMICS_REQUIRED; FINALIST_EVIDENCE_DOES_NOT_AUTHORIZE_PURCHASE; NEVER_INFER_SALES'
  };
}
