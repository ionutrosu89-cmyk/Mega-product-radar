import assert from 'node:assert/strict';
import test from 'node:test';
import {assessLegalReadiness} from '../netlify/functions/legal-readiness.mjs';

const complete={
  LEGAL_REFUND_POLICY_APPROVED:'true',
  LEGAL_TERMS_REVIEWED_AT:'2026-09-01',
  LEGAL_PRIVACY_REVIEWED_AT:'2026-09-01',
  LEGAL_COOKIE_VERSION:'2026-09-07',
  LEGAL_COOKIE_REVIEWED_AT:'2026-09-07',
  LEGAL_SUBPROCESSORS_VERSION:'2026-09-07',
  LEGAL_SUBPROCESSORS_REVIEWED_AT:'2026-09-07'
};

test('legal readiness fails closed without cookie and subprocessor reviews',()=>{
  const result=assessLegalReadiness({
    LEGAL_REFUND_POLICY_APPROVED:'true',
    LEGAL_TERMS_REVIEWED_AT:'2026-09-01',
    LEGAL_PRIVACY_REVIEWED_AT:'2026-09-01'
  });
  assert.equal(result.legalCoreReady,false);
  assert.equal(result.checks.cookiePolicyReviewed,false);
  assert.equal(result.checks.subprocessorsReviewed,false);
  assert.equal(result.checks.policyVersionsComplete,false);
});

test('legal readiness requires version and review date together',()=>{
  const missingVersion=assessLegalReadiness({...complete,LEGAL_COOKIE_VERSION:''});
  assert.equal(missingVersion.ready,false);
  assert.equal(missingVersion.checks.cookiePolicyReviewed,false);

  const missingReview=assessLegalReadiness({...complete,LEGAL_SUBPROCESSORS_REVIEWED_AT:''});
  assert.equal(missingReview.ready,false);
  assert.equal(missingReview.checks.subprocessorsReviewed,false);
});

test('legal core becomes ready only when all mandatory policy reviews are recorded',()=>{
  const result=assessLegalReadiness(complete);
  assert.equal(result.ready,true);
  assert.equal(result.legalCoreReady,true);
  assert.equal(result.checks.identityComplete,true);
  assert.equal(result.checks.policyVersionsComplete,true);
  assert.equal(result.checks.approvalsComplete,true);
  assert.equal(result.checks.cookiePolicyReviewed,true);
  assert.equal(result.checks.subprocessorsReviewed,true);
});
