const text=v=>String(v??'').trim();
const key=v=>text(v).toUpperCase();

function evidenceRows(evidence={}){
  const pools=['rows','products','packets','items','candidates','records'];
  return pools.flatMap(name=>Array.isArray(evidence?.[name])?evidence[name]:[]);
}

function rowMatchesCandidate(row={},asin=''){
  const ids=[row.candidateAsin,row.asin,row.externalId,row.productAsin,row.productKey,row.candidateKey]
    .map(key).filter(Boolean);
  return ids.includes(asin);
}

function candidateSupplierVerified(evidence={},asin=''){
  return evidenceRows(evidence).some(row=>rowMatchesCandidate(row,asin)&&(
    row.manuallyVerified===true||row.supplierVerified===true||row.currentEvidenceLevel==='MANUALLY_VERIFIED'||row.evidenceLevel==='MANUALLY_VERIFIED'
  ));
}

function candidateEconomicsConfirmed(evidence={},asin=''){
  return evidenceRows(evidence).some(row=>rowMatchesCandidate(row,asin)&&(
    row.landedEconomicsConfirmed===true||row.economicsConfirmed===true||row.confirmedLandedEconomics===true||row.status==='CONFIRMED_LANDED_ECONOMICS'
  ));
}

export function buildFirstFinalistDecision({candidateAsin,trendFusion={},romaniaEvidence={},importabilityEvidence={},supplierEvidence={},economicsEvidence={}}={}){
  const asin=key(candidateAsin);
  const trendRow=(trendFusion.rows||[]).find(r=>key(r.externalId)===asin);
  const trendConfirmed=!!trendRow&&trendRow.confirmedAcceleration===true&&trendRow.status==='CONFIRMED_ACCELERATION';
  const sameRomaniaCandidate=key(romaniaEvidence.candidateAsin)===asin;
  const romaniaGapConfirmed=sameRomaniaCandidate&&romaniaEvidence.promotion?.exactRomaniaGapConfirmed===true&&romaniaEvidence.promotion?.promotionEligible===true;
  const sameImportabilityCandidate=key(importabilityEvidence.candidateAsin)===asin;
  const importabilityPassed=sameImportabilityCandidate&&importabilityEvidence.importabilityPassed===true&&importabilityEvidence.status==='IMPORTABILITY_PASS';
  const importabilityReviewEligible=sameImportabilityCandidate&&importabilityEvidence.supplierSourcingEligible===true&&(importabilityEvidence.status==='IMPORTABILITY_PASS'||importabilityEvidence.status==='IMPORTABILITY_REVIEW');
  const supplierVerified=candidateSupplierVerified(supplierEvidence,asin);
  const economicsConfirmed=candidateEconomicsConfirmed(economicsEvidence,asin);
  const purchaseAuthorized=false;

  const gates={trendConfirmed,romaniaGapConfirmed,importabilityPassed,supplierVerified,economicsConfirmed};
  const passed=Object.values(gates).filter(Boolean).length;
  let status='BLOCKED_BEFORE_VALIDATE';
  if(trendConfirmed&&romaniaGapConfirmed) status='VALIDATE_SUPPORT_READY';
  if(trendConfirmed&&romaniaGapConfirmed&&!importabilityReviewEligible) status='VALIDATE_READY_IMPORTABILITY_BLOCKED';
  if(trendConfirmed&&romaniaGapConfirmed&&importabilityPassed&&supplierVerified&&economicsConfirmed) status='FINALIST_EVIDENCE_READY';

  const blockers=[];
  if(!trendConfirmed) blockers.push('CONFIRMED_TREND_FUSION_MISSING');
  if(!romaniaGapConfirmed) blockers.push('EXACT_ROMANIA_GAP_MISSING');
  if(!importabilityPassed) blockers.push('CANDIDATE_IMPORTABILITY_PASS_MISSING');
  if(!supplierVerified) blockers.push('CANDIDATE_MANUALLY_VERIFIED_SUPPLIER_MISSING');
  if(!economicsConfirmed) blockers.push('CANDIDATE_CONFIRMED_LANDED_ECONOMICS_MISSING');

  return {
    schemaVersion:'MPR_FIRST_FINALIST_DECISION_V1',candidateAsin:asin||null,status,
    gatesPassed:passed,gatesTotal:5,gates,blockers,
    validateEligible:trendConfirmed&&romaniaGapConfirmed,
    supplierSourcingEligible:trendConfirmed&&romaniaGapConfirmed&&importabilityReviewEligible,
    finalistEvidenceReady:trendConfirmed&&romaniaGapConfirmed&&importabilityPassed&&supplierVerified&&economicsConfirmed,
    testReady:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized,
    policy:'FAIL_CLOSED; SAME_ASIN_TREND_ROMANIA_IMPORTABILITY_SUPPLIER_ECONOMICS; IMPORTABILITY_REQUIRED_BEFORE_SUPPLIER_SOURCING; STRICT_IMPORTABILITY_PASS_REQUIRED_FOR_FINALIST; CANDIDATE_SPECIFIC_MANUAL_SUPPLIER_REQUIRED; CANDIDATE_SPECIFIC_CONFIRMED_LANDED_ECONOMICS_REQUIRED; GLOBAL_COUNTS_NEVER_SATISFY_CANDIDATE_GATES; FINALIST_EVIDENCE_DOES_NOT_AUTHORIZE_PURCHASE; NEVER_INFER_SALES'
  };
}
