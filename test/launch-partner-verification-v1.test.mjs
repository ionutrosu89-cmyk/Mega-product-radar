import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateLaunchPartnerVerification} from '../launch-partner-verification-v1.js';

const complete={
  partnerKey:'TEST_PARTNER',
  evidenceClass:'PUBLIC_SELF_CLAIM',
  legalEntityVerified:true,
  chinaPresenceVerified:true,
  writtenCommercialTerms:true,
  capability1688Confirmed:true,
  supplierPaymentModelConfirmed:true,
  qcMethodConfirmed:true,
  ddpCustomsResponsibilityConfirmed:true,
  insuranceClaimsProcessConfirmed:true,
  sampleConsolidationProcessConfirmed:true,
  euRomaniaDeliveryConfirmed:true,
  referencesChecked:true,
  realServiceInteractionCompleted:true,
  testServiceCompleted:true,
  manualMprApproval:true
};

test('public shortlist candidates are not MPR verified or tested',()=>{
  const d=JSON.parse(fs.readFileSync(new URL('../data/launch-partner-public-candidates-v1.json',import.meta.url),'utf8'));
  assert.ok(d.candidates.length>=5);
  for(const c of d.candidates){
    assert.equal(c.reviewStatus,'PUBLIC_CANDIDATE');
    assert.equal(c.mprVerified,false);
    assert.equal(c.testedByMpr,false);
    const out=evaluateLaunchPartnerVerification(c);
    assert.equal(out.customerFacingVerifiedLabelAllowed,false);
  }
});

test('public claims plus most paperwork cannot unlock verified label without a real test',()=>{
  const out=evaluateLaunchPartnerVerification({...complete,testServiceCompleted:false});
  assert.equal(out.mprVerified,false);
  assert.equal(out.testedByMpr,false);
  assert.equal(out.customerFacingVerifiedLabelAllowed,false);
  assert.ok(out.blockers.includes('MISSING_TEST_SERVICE_COMPLETED'));
});

test('real service test without manual MPR approval still fails closed',()=>{
  const out=evaluateLaunchPartnerVerification({...complete,manualMprApproval:false});
  assert.equal(out.mprVerified,false);
  assert.ok(out.blockers.includes('MISSING_MANUAL_MPR_APPROVAL'));
});

test('all verification checks including service interaction and test permit the customer-facing label',()=>{
  const out=evaluateLaunchPartnerVerification(complete);
  assert.equal(out.mprVerified,true);
  assert.equal(out.testedByMpr,true);
  assert.equal(out.customerFacingVerifiedLabelAllowed,true);
  assert.equal(out.reviewStatus,'MPR_VERIFIED_TESTED_PARTNER');
  assert.equal(out.purchaseAuthorized,false);
});

test('verification engine contains no network or purchase execution',()=>{
  const src=fs.readFileSync(new URL('../launch-partner-verification-v1.js',import.meta.url),'utf8');
  assert.equal(/\bfetch\s*\(/.test(src),false);
  assert.equal(/purchaseAuthorized\s*:\s*true/.test(src),false);
});
