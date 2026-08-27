import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceEnvelopeV2} from '../evidence-envelope-v2.js';
import {evaluatePolicyKernel} from '../policy-kernel-v1.js';

const validInput=()=>({
  evidenceId:'ev-1',
  expectedIdentity:{canonicalProductId:'cp-1',marketplace:'amazon.com',externalId:'B00INKVS82'},
  observedIdentity:{canonicalProductId:'cp-1',marketplace:'amazon.com',externalId:'B00INKVS82'},
  source:{
    name:'amazon-public-product-page',
    url:'https://www.amazon.com/dp/B00INKVS82',
    observedAt:'2026-08-27T05:00:00Z',
    collectedAt:'2026-08-27T05:00:01Z',
    parserVersion:'amazon-bsr-v1'
  },
  provenance:{collector:'github-actions-public-http',runId:'33046534587',artifactId:'9635852916',contentSha256:'abc123'},
  sourceRights:{analysisAllowed:true,commercialUseAllowed:false,basis:'PUBLIC_ANALYSIS_ONLY'},
  evidenceStrength:'STRONG',
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  verifiedSalesRows:0,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false
});

test('Policy Kernel accepts exact zero-cost analysis evidence with complete provenance',()=>{
  const envelope=createEvidenceEnvelopeV2(validInput());
  const result=evaluatePolicyKernel(envelope,{intendedUse:'analysis'});
  assert.equal(result.decision,'ACCEPT');
  assert.equal(result.accepted,true);
  assert.equal(result.scaleAuthorized,true);
  assert.equal(result.purchaseAuthorized,false);
  assert.equal(result.monetizationAuthorized,false);
});

test('identity mismatch fails closed even when the source returned data',()=>{
  const input=validInput();
  input.observedIdentity.externalId='B000000000';
  const result=evaluatePolicyKernel(createEvidenceEnvelopeV2(input));
  assert.equal(result.decision,'HOLD');
  assert.ok(result.reasons.some(x=>x.code==='IDENTITY_NOT_CONFIRMED'));
});

test('strong evidence without complete provenance is rejected',()=>{
  const input=validInput();
  input.provenance.contentSha256='';
  const result=evaluatePolicyKernel(createEvidenceEnvelopeV2(input));
  assert.equal(result.decision,'HOLD');
  assert.ok(result.reasons.some(x=>x.code==='STRONG_EVIDENCE_REQUIREMENTS_MISSING'));
});

test('any provider spend or paid data call is blocked',()=>{
  const input=validInput();
  input.providerDataSpendEur=0.01;
  input.paidDataCallsTriggered=1;
  const result=evaluatePolicyKernel(createEvidenceEnvelopeV2(input));
  assert.equal(result.decision,'HOLD');
  assert.equal(result.guards.spend.code,'PAID_DATA_ACTIVITY_BLOCKED');
});

test('purchase authorization cannot enter the trust pipeline',()=>{
  const input=validInput();
  input.purchaseAuthorized=true;
  const result=evaluatePolicyKernel(createEvidenceEnvelopeV2(input));
  assert.equal(result.decision,'HOLD');
  assert.equal(result.guards.purchase.code,'PURCHASE_AUTHORIZATION_FORBIDDEN');
  assert.equal(result.purchaseAuthorized,false);
});

test('VERIFIED_SALES claim requires verified rows and strong provenance',()=>{
  const input=validInput();
  input.salesEvidenceClass='VERIFIED_SALES';
  input.verifiedSalesRows=0;
  const result=evaluatePolicyKernel(createEvidenceEnvelopeV2(input));
  assert.equal(result.decision,'HOLD');
  assert.equal(result.guards.truth.code,'UNSUPPORTED_VERIFIED_SALES_CLAIM');
});

test('commercial use fails until commercial source rights are explicitly confirmed',()=>{
  const result=evaluatePolicyKernel(createEvidenceEnvelopeV2(validInput()),{intendedUse:'commercial'});
  assert.equal(result.decision,'HOLD');
  assert.equal(result.guards.sourceRights.code,'SOURCE_RIGHTS_NOT_CONFIRMED');
  assert.equal(result.monetizationAuthorized,false);
});
