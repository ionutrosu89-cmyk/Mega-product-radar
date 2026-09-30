import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateStageFacts} from '../evidence-stage-policy.js';
import {productEvidenceDecision} from '../product-evidence-decision.js';
import {evidenceFreshness,productEvidenceFreshness} from '../evidence-freshness.js';
const facts={promising:true,marketQualified:true,confidence:80,trendConfirmed:true,romaniaExact:true,supplierVerified:true,economicsConfirmed:true,importabilityPassed:true,fresh:true};
test('each commercial evidence gate is independently required for FINALIST',()=>{
 assert.equal(evaluateStageFacts(facts).stage,'FINALIST');
 for(const gate of ['trendConfirmed','romaniaExact','supplierVerified','economicsConfirmed','importabilityPassed','fresh'])assert.notEqual(evaluateStageFacts({...facts,[gate]:false}).stage,'FINALIST',gate);
 assert.equal(evaluateStageFacts({...facts,testGatesPassed:true}).stage,'TEST_READY');
 assert.equal(evaluateStageFacts({...facts,testGatesPassed:true,measuredTestPassed:true}).stage,'BUY_READY');
 assert.equal(evaluateStageFacts({...facts,measuredTestPassed:true}).stage,'FINALIST');
});
test('legacy high score and BUY label cannot promote missing or stale evidence',()=>{
 const p={score:100,updatedAt:new Date().toISOString(),testBuyDecision:{commercialAction:'BUY'},goldenPipeline:{stage:'FINALIST'}};
 assert.equal(productEvidenceDecision(p).stage,'PROMISING');
 assert.equal(productEvidenceFreshness(p).status,'UNKNOWN');
});
test('freshness uses observation time, rejects future dates, and preserves unknown',()=>{
 const now=Date.parse('2026-09-19T12:00:00Z');
 assert.equal(evidenceFreshness(null,{now}).status,'UNKNOWN');
 assert.equal(evidenceFreshness('2026-09-20T00:00:00Z',{now}).status,'INVALID_FUTURE');
 assert.equal(evidenceFreshness('2026-09-01T00:00:00Z',{now}).status,'STALE');
 assert.equal(evidenceFreshness('2026-09-18T00:00:00Z',{now}).status,'CURRENT');
});
