const bool=v=>v===true;
const up=v=>String(v??'').trim().toUpperCase();

export function evaluateLaunchPartnerVerification(input={}){
  const checks={
    legalEntityVerified:bool(input.legalEntityVerified),
    chinaPresenceVerified:bool(input.chinaPresenceVerified),
    writtenCommercialTerms:bool(input.writtenCommercialTerms),
    capability1688Confirmed:bool(input.capability1688Confirmed),
    supplierPaymentModelConfirmed:bool(input.supplierPaymentModelConfirmed),
    qcMethodConfirmed:bool(input.qcMethodConfirmed),
    ddpCustomsResponsibilityConfirmed:bool(input.ddpCustomsResponsibilityConfirmed),
    insuranceClaimsProcessConfirmed:bool(input.insuranceClaimsProcessConfirmed),
    sampleConsolidationProcessConfirmed:bool(input.sampleConsolidationProcessConfirmed),
    euRomaniaDeliveryConfirmed:bool(input.euRomaniaDeliveryConfirmed),
    referencesChecked:bool(input.referencesChecked),
    realServiceInteractionCompleted:bool(input.realServiceInteractionCompleted),
    testServiceCompleted:bool(input.testServiceCompleted),
    manualMprApproval:bool(input.manualMprApproval)
  };
  const blockers=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>`MISSING_${k.replace(/[A-Z]/g,m=>'_'+m).toUpperCase()}`);
  const sourceClass=up(input.evidenceClass||'PUBLIC_SELF_CLAIM');
  const verified=blockers.length===0&&sourceClass!=='UNKNOWN';
  return {
    version:'1.0',
    partnerKey:input.partnerKey||null,
    reviewStatus:verified?'MPR_VERIFIED_TESTED_PARTNER':blockers.length<=4?'MANUAL_REVIEW_ADVANCED':'PUBLIC_CANDIDATE',
    mprVerified:verified,
    testedByMpr:verified,
    customerFacingVerifiedLabelAllowed:verified,
    evidenceClass:verified?'MPR_MANUALLY_VERIFIED_AND_TESTED':sourceClass||'PUBLIC_SELF_CLAIM',
    checks,
    blockers,
    purchaseAuthorized:false,
    paidCallsTriggered:0,
    policy:'PUBLIC_CLAIMS_NEVER_EQUAL_MPR_VERIFIED; VERIFIED_LABEL_REQUIRES_REAL_SERVICE_INTERACTION_AND_TEST_SERVICE; NO_PARTNER_BYPASSES_SUPPLIER_COMPLIANCE_ECONOMICS_TEST_OR_MONEY_GATES'
  };
}
