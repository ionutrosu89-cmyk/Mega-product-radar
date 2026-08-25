import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLaunchPartnerDueDiligencePacket } from '../launch-partner-due-diligence-v1.js';

const candidate={partnerKey:'P1',name:'Partner 1',sourceUrl:'https://example.com',evidenceClass:'PUBLIC_SELF_CLAIM'};
const docs={legalEntityVerified:true,chinaPresenceVerified:true,writtenCommercialTerms:true,capability1688Confirmed:true,supplierPaymentModelConfirmed:true,qcMethodConfirmed:true,ddpCustomsResponsibilityConfirmed:true,insuranceClaimsProcessConfirmed:true,sampleConsolidationProcessConfirmed:true,euRomaniaDeliveryConfirmed:true,referencesChecked:true};

test('public candidate starts blocked and cannot show verified label',()=>{
 const x=buildLaunchPartnerDueDiligencePacket(candidate,{});
 assert.equal(x.stage,'PUBLIC_CANDIDATE');
 assert.equal(x.mprVerified,false);
 assert.equal(x.customerFacingVerifiedLabelAllowed,false);
});

test('complete documentary review still does not equal tested partner',()=>{
 const x=buildLaunchPartnerDueDiligencePacket(candidate,docs);
 assert.equal(x.stage,'DOCUMENTS_VERIFIED');
 assert.equal(x.testedByMpr,false);
 assert.equal(x.customerFacingVerifiedLabelAllowed,false);
});

test('test service without manual approval stays pending',()=>{
 const x=buildLaunchPartnerDueDiligencePacket(candidate,{...docs,realServiceInteractionCompleted:true,testServiceCompleted:true});
 assert.equal(x.stage,'TESTED_PENDING_APPROVAL');
 assert.equal(x.mprVerified,false);
});

test('only full evidence plus manual approval reaches MPR_VERIFIED',()=>{
 const x=buildLaunchPartnerDueDiligencePacket(candidate,{...docs,realServiceInteractionCompleted:true,testServiceCompleted:true,manualMprApproval:true});
 assert.equal(x.stage,'MPR_VERIFIED');
 assert.equal(x.mprVerified,true);
 assert.equal(x.customerFacingVerifiedLabelAllowed,true);
 assert.equal(x.purchaseAuthorized,false);
});
