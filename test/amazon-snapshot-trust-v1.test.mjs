import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAmazonSnapshotTrust} from '../amazon-snapshot-trust-v1.js';

const base=()=>({
  asin:'B00INKVS82',
  url:'https://www.amazon.com/dp/B00INKVS82',
  observedAt:'2026-08-27T08:00:00Z',
  collectedAt:'2026-08-27T08:00:01Z',
  statusCode:200,
  htmlBytes:12345,
  contentSha256:'abc123',
  identityConfirmed:true,
  rankEvidenceCount:2
});

test('Amazon snapshot remains HOLD while source analysis rights are unconfirmed',()=>{
  const trust=buildAmazonSnapshotTrust(base(),{runId:'run-1'});
  assert.equal(trust.envelope.schema,'EvidenceEnvelopeV2');
  assert.equal(trust.envelope.providerDataSpendEur,0);
  assert.equal(trust.envelope.paidDataCallsTriggered,0);
  assert.equal(trust.envelope.purchaseAuthorized,false);
  assert.equal(trust.envelope.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(trust.policy.decision,'HOLD');
  assert.ok(trust.policy.reasons.some(x=>x.code==='SOURCE_RIGHTS_NOT_CONFIRMED'));
});

test('identity-not-confirmed Amazon page is explicitly rejected by the Policy Kernel',()=>{
  const input=base();
  input.identityConfirmed=false;
  input.rankEvidenceCount=0;
  const trust=buildAmazonSnapshotTrust(input,{runId:'run-2'});
  assert.equal(trust.policy.decision,'HOLD');
  assert.equal(trust.policy.guards.identity.code,'IDENTITY_NOT_CONFIRMED');
  assert.equal(trust.envelope.evidenceStrength,'SUPPORT_ONLY');
});

test('explicit BSR can become strong analysis evidence only when rights are explicitly confirmed',()=>{
  const trust=buildAmazonSnapshotTrust(base(),{
    runId:'run-3',
    sourceRights:{analysisAllowed:true,commercialUseAllowed:false,basis:'EXPLICIT_ANALYSIS_RIGHT_CONFIRMED'}
  });
  assert.equal(trust.envelope.evidenceStrength,'STRONG');
  assert.equal(trust.policy.decision,'ACCEPT');
  assert.equal(trust.policy.purchaseAuthorized,false);
  assert.equal(trust.policy.monetizationAuthorized,false);
});

test('commercial use stays blocked when only analysis rights are confirmed',()=>{
  const trust=buildAmazonSnapshotTrust(base(),{
    runId:'run-4',
    intendedUse:'commercial',
    sourceRights:{analysisAllowed:true,commercialUseAllowed:false,basis:'ANALYSIS_ONLY'}
  });
  assert.equal(trust.policy.decision,'HOLD');
  assert.equal(trust.policy.guards.sourceRights.code,'SOURCE_RIGHTS_NOT_CONFIRMED');
  assert.equal(trust.policy.monetizationAuthorized,false);
});
