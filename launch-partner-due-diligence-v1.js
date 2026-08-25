import { evaluateLaunchPartnerVerification } from './launch-partner-verification-v1.js';

const DOC_CHECKS=['legalEntityVerified','chinaPresenceVerified','writtenCommercialTerms','capability1688Confirmed','supplierPaymentModelConfirmed','qcMethodConfirmed','ddpCustomsResponsibilityConfirmed','insuranceClaimsProcessConfirmed','sampleConsolidationProcessConfirmed','euRomaniaDeliveryConfirmed','referencesChecked'];

export function buildLaunchPartnerDueDiligencePacket(candidate={}, evidence={}){
  const evaluation=evaluateLaunchPartnerVerification({partnerKey:candidate.partnerKey,evidenceClass:candidate.evidenceClass,...evidence});
  const docsPassed=DOC_CHECKS.filter(k=>evaluation.checks[k]).length;
  const docsTotal=DOC_CHECKS.length;
  let stage='PUBLIC_CANDIDATE';
  if(docsPassed>0)stage='VERIFICATION_IN_PROGRESS';
  if(docsPassed===docsTotal)stage='DOCUMENTS_VERIFIED';
  if(docsPassed===docsTotal&&evaluation.checks.realServiceInteractionCompleted)stage='SERVICE_INTERACTION_COMPLETE';
  if(docsPassed===docsTotal&&evaluation.checks.realServiceInteractionCompleted&&evaluation.checks.testServiceCompleted)stage='TESTED_PENDING_APPROVAL';
  if(evaluation.mprVerified)stage='MPR_VERIFIED';
  return {
    version:'1.0',partnerKey:candidate.partnerKey??null,name:candidate.name??null,sourceUrl:candidate.sourceUrl??null,
    stage,docsPassed,docsTotal,mprVerified:evaluation.mprVerified,testedByMpr:evaluation.testedByMpr,
    customerFacingVerifiedLabelAllowed:evaluation.customerFacingVerifiedLabelAllowed,
    blockers:evaluation.blockers,
    nextActions:[
      ...(evaluation.checks.legalEntityVerified?[]:['VERIFY_LEGAL_ENTITY']),
      ...(evaluation.checks.chinaPresenceVerified?[]:['VERIFY_CHINA_PRESENCE']),
      ...(evaluation.checks.writtenCommercialTerms?[]:['OBTAIN_WRITTEN_COMMERCIAL_TERMS']),
      ...(evaluation.checks.referencesChecked?[]:['CHECK_REFERENCES']),
      ...(docsPassed===docsTotal&&!evaluation.checks.realServiceInteractionCompleted?['COMPLETE_REAL_SERVICE_INTERACTION']:[]),
      ...(evaluation.checks.realServiceInteractionCompleted&&!evaluation.checks.testServiceCompleted?['RUN_CONTROLLED_TEST_SERVICE']:[]),
      ...(evaluation.checks.testServiceCompleted&&!evaluation.checks.manualMprApproval?['MANUAL_MPR_APPROVAL']:[])
    ],
    purchaseAuthorized:false,paidCallsTriggered:0
  };
}

export function buildLaunchPartnerDueDiligenceQueue(candidates=[],evidenceByPartner={}){
 const packets=candidates.map(c=>buildLaunchPartnerDueDiligencePacket(c,evidenceByPartner[c.partnerKey]||{}));
 return {version:'1.0',policy:'PUBLIC_CANDIDATE -> DOCUMENTS_VERIFIED -> SERVICE_INTERACTION_COMPLETE -> TESTED_PENDING_APPROVAL -> MPR_VERIFIED; NO_SHORTCUTS',stats:{total:packets.length,verified:packets.filter(p=>p.mprVerified).length,tested:packets.filter(p=>p.testedByMpr).length},packets,purchaseAuthorized:false};
}
