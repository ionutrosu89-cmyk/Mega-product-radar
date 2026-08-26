import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrendDecisionEvidence} from '../trend-decision-evidence-v2.js';

const A='11111111-1111-4111-8111-111111111111';

test('persistent high-confidence trend can only support VALIDATE',()=>{
 const r=buildTrendDecisionEvidence({canonicalProductId:A,decisionEligible:true,status:'PERSISTENT_TREND',trendScore:90,confidence:90});
 assert.equal(r.gateStatus,'PASS');assert.equal(r.maximumContribution,'VALIDATE_SUPPORT_ONLY');assert.equal(r.canPromoteToFinalist,false);assert.equal(r.canPromoteToBuyReady,false);assert.equal(r.purchaseAuthorized,false);
});

test('high trend score with low confidence fails closed to review',()=>{
 const r=buildTrendDecisionEvidence({canonicalProductId:A,decisionEligible:true,status:'PERSISTENT_TREND',trendScore:100,confidence:20});
 assert.equal(r.gateStatus,'REVIEW');assert.equal(r.maximumContribution,'PROMISING_SUPPORT_ONLY');
});

test('spike never passes trend gate even with score 100',()=>{
 const r=buildTrendDecisionEvidence({canonicalProductId:A,decisionEligible:true,status:'SPIKE_OR_REVERSAL',trendScore:100,confidence:95});
 assert.equal(r.gateStatus,'REVIEW');assert.ok(r.reasons.includes('SPIKE_IS_NOT_PERSISTENT_TREND'));
});

test('conflicting product surfaces never pass trend gate',()=>{
 const r=buildTrendDecisionEvidence({canonicalProductId:A,decisionEligible:true,status:'MIXED_OR_CONFLICTED',trendScore:95,confidence:85});
 assert.equal(r.gateStatus,'REVIEW');assert.equal(r.maximumContribution,'PROMISING_SUPPORT_ONLY');assert.equal(r.canPromoteToFinalist,false);
});

test('unbound trend evidence cannot become decision eligible',()=>{
 const r=buildTrendDecisionEvidence({canonicalProductId:null,decisionEligible:false,status:'PERSISTENT_TREND',trendScore:100,confidence:100});
 assert.equal(r.gateStatus,'UNKNOWN');assert.equal(r.decisionEligible,false);assert.ok(r.reasons.includes('CANONICAL_PRODUCT_ID_REQUIRED'));
});
