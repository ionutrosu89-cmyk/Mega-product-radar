import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCanonicalDecision,canLegacySignalPromote} from '../single-decision-authority-v1.js';

const blocked={status:'BLOCKED_BEFORE_VALIDATE',validateEligible:false,finalistEvidenceReady:false,purchaseAuthorized:false};
const validate={status:'VALIDATE_SUPPORT_READY',validateEligible:true,finalistEvidenceReady:false,purchaseAuthorized:false};
const finalist={status:'FINALIST_EVIDENCE_READY',validateEligible:true,finalistEvidenceReady:true,purchaseAuthorized:false};

test('legacy BUY can never override evidence BLOCKED',()=>{
  const r=buildCanonicalDecision({evidenceDecision:blocked,legacySignals:[{source:'legacy-score',recommendation:'BUY',score:99}]});
  assert.equal(r.stage,'BLOCKED');
  assert.equal(r.legacyConflict,true);
  assert.equal(r.legacySignals[0].authority,false);
  assert.equal(r.purchaseAuthorized,false);
});

test('legacy score cannot promote VALIDATE to FINALIST or BUY',()=>{
  const r=buildCanonicalDecision({evidenceDecision:validate,legacySignals:[{recommendation:'STRONG_BUY',score:100}]});
  assert.equal(r.stage,'VALIDATE');
  assert.equal(r.legacyConflict,true);
});

test('FINALIST evidence alone never becomes TEST_READY or BUY_READY',()=>{
  const r=buildCanonicalDecision({evidenceDecision:finalist});
  assert.equal(r.stage,'FINALIST');
  assert.equal(r.purchaseAuthorized,false);
});

test('test stages require measured real-world evidence and FINALIST foundation',()=>{
  const ignored=buildCanonicalDecision({evidenceDecision:finalist,realTestEvidence:{status:'TEST_READY',testReady:true,measuredRealWorldEvidence:false}});
  assert.equal(ignored.stage,'FINALIST');
  const accepted=buildCanonicalDecision({evidenceDecision:finalist,realTestEvidence:{status:'TEST_READY',testReady:true,measuredRealWorldEvidence:true}});
  assert.equal(accepted.stage,'TEST_READY');
});

test('BUY_READY requires measured real-world test evidence but still does not authorize a purchase',()=>{
  const r=buildCanonicalDecision({evidenceDecision:finalist,realTestEvidence:{status:'BUY_READY',buyReady:true,measuredRealWorldEvidence:true}});
  assert.equal(r.stage,'BUY_READY');
  assert.equal(r.purchaseAuthorized,false);
  assert.equal(r.automaticPurchaseAllowed,false);
});

test('malformed decision packet claiming purchase authority fails closed',()=>{
  const r=buildCanonicalDecision({evidenceDecision:{...finalist,purchaseAuthorized:true},realTestEvidence:{status:'BUY_READY',buyReady:true,measuredRealWorldEvidence:true}});
  assert.equal(r.stage,'BLOCKED');
  assert.match(r.reason,/PURCHASE_AUTHORITY_FORBIDDEN/);
});

test('legacy promotion is disabled by policy',()=>{
  assert.equal(canLegacySignalPromote(),false);
});
