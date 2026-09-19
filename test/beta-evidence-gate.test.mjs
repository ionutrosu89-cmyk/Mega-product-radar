import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBetaEvidence} from '../beta-evidence-gate.js';
const session=id=>({userId:id,realParticipant:true,understoodEvidence:true,useful:true,completedWatchlist:true});
test('synthetic, duplicate and missing participants cannot open the beta gate',()=>{
 const r=evaluateBetaEvidence({sessions:[session('a'),session('a'),{...session('b'),realParticipant:false}],technicalChecksPassed:true,confirmedProductFlow:true});
 assert.equal(r.metrics.participants,1);assert.equal(r.decision,'CONTINUE_FREE_BETA');assert.equal(r.paidBillingEnabled,false);
});
test('real beta evidence requires successful technical and product-flow acceptance',()=>{
 const sessions=Array.from({length:5},(_,i)=>session(String(i)));
 assert.equal(evaluateBetaEvidence({sessions}).decision,'CONTINUE_FREE_BETA');
 const passed=evaluateBetaEvidence({sessions,technicalChecksPassed:true,confirmedProductFlow:true});
 assert.equal(passed.decision,'READY_FOR_HUMAN_LAUNCH_REVIEW');assert.equal(passed.paidBillingEnabled,false);
 assert.equal(evaluateBetaEvidence({sessions,technicalChecksPassed:true,confirmedProductFlow:true,criticalIssues:1}).decision,'CONTINUE_FREE_BETA');
});
