import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDataQualityReport} from '../data-quality-report-v1.js';

const rows=(count,obs)=>Array.from({length:count},(_,i)=>({canonicalProductId:`x-${i}`,observationCount:typeof obs==='function'?obs(i):obs}));

test('holds scale when current coverage is below management targets',()=>{
 const universe={products:rows(1000,i=>i<100?2:1),metrics:{canonicalProducts:1000,sourceIdentityCoveragePct:80,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:1000,unboundObservations:50}};
 const r=buildDataQualityReport(universe,{longitudinalReady:50,decisionEligibleSeries:40});
 assert.equal(r.status,'HOLD_SCALE');assert.equal(r.scaleAuthorized,false);assert.ok(r.blockers.includes('TWO_PLUS_HISTORY'));assert.ok(r.blockers.includes('THREE_PLUS_HISTORY'));assert.equal(r.automaticPaidExpansionAllowed,false);
});

test('passes only when all quality gates pass',()=>{
 const universe={products:rows(4000,i=>i<1000?3:2),metrics:{canonicalProducts:4000,sourceIdentityCoveragePct:80,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:7000,unboundObservations:500}};
 const r=buildDataQualityReport(universe,{longitudinalReady:3000,decisionEligibleSeries:2500});
 assert.equal(r.status,'READY_FOR_CONTROLLED_10K_SCALE');assert.equal(r.scaleAuthorized,true);assert.equal(r.blockers.length,0);assert.equal(r.purchaseAuthorized,false);
});

test('excess unbound observation share blocks scale',()=>{
 const universe={products:rows(4000,i=>i<1000?3:2),metrics:{canonicalProducts:4000,sourceIdentityCoveragePct:80,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:1000,unboundObservations:1000}};
 const r=buildDataQualityReport(universe,{});assert.ok(r.blockers.includes('UNBOUND_OBSERVATIONS'));
});
