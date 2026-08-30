import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLegalReadiness} from '../netlify/functions/legal-readiness.mjs';

const complete={
  LEGAL_OPERATOR_NAME:'Example SRL',
  LEGAL_OPERATOR_VAT:'RO123456',
  LEGAL_OPERATOR_REGISTRY:'J00/00/2026',
  LEGAL_OPERATOR_ADDRESS:'Bucharest, Romania',
  LEGAL_SUPPORT_EMAIL:'support@example.ro',
  LEGAL_REFUND_POLICY_APPROVED:'true',
  LEGAL_TERMS_REVIEWED_AT:'2026-08-01',
  LEGAL_PRIVACY_REVIEWED_AT:'2026-08-01'
};

test('legal readiness passes only with complete identity and approvals',()=>{
  const state=assessLegalReadiness(complete);
  assert.equal(state.ready,true);
  assert.equal(state.checks.identityComplete,true);
  assert.equal(state.checks.approvalsComplete,true);
});

test('invalid support email blocks legal readiness',()=>{
  const state=assessLegalReadiness({...complete,LEGAL_SUPPORT_EMAIL:'not-an-email'});
  assert.equal(state.ready,false);
  assert.equal(state.checks.supportEmailValid,false);
});

test('missing operator identity blocks legal readiness',()=>{
  const state=assessLegalReadiness({...complete,LEGAL_OPERATOR_ADDRESS:''});
  assert.equal(state.ready,false);
  assert.equal(state.checks.identityComplete,false);
});

test('future or missing legal reviews stay fail-closed',()=>{
  const state=assessLegalReadiness({...complete,LEGAL_TERMS_REVIEWED_AT:'2999-01-01',LEGAL_PRIVACY_REVIEWED_AT:''});
  assert.equal(state.ready,false);
  assert.equal(state.approvals.LEGAL_TERMS_REVIEWED_AT,false);
  assert.equal(state.approvals.LEGAL_PRIVACY_REVIEWED_AT,false);
});
