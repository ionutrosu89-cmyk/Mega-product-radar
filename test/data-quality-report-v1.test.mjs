import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDataQualityReport} from '../data-quality-report-v1.js';

const rows=(count,obs)=>Array.from({length:count},(_,i)=>({canonicalProductId:`x-${i}`,observationCount:typeof obs==='function'?obs(i):obs}));

test('holds scale when entry coverage is below management targets',()=>{
 const universe={products:rows(1000,1),metrics:{canonicalProducts:1000,sourceIdentityCoveragePct:50,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:1000,unboundObservations:50}};
 const r=buildDataQualityReport(universe,{longitudinalReady:50,decisionEligibleSeries:40});
 assert.equal(r.status,'HOLD_SCALE');assert.equal(r.scaleAuthorized,false);assert.ok(r.blockers.includes('SOURCE_IDENTITY_COVERAGE'));assert.equal(r.automaticPaidExpansionAllowed,false);
});

test('a clean 1k baseline can authorize controlled scale even before 10k milestones are reached',()=>{
 const universe={products:rows(1000,i=>i<100?2:1),metrics:{canonicalProducts:1000,sourceIdentityCoveragePct:80,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:1000,unboundObservations:50}};
 const r=buildDataQualityReport(universe,{longitudinalReady:100,decisionEligibleSeries:90});
 assert.equal(r.status,'READY_FOR_CONTROLLED_SCALE');assert.equal(r.scaleAuthorized,true);assert.equal(r.blockers.length,0);assert.equal(r.tenKMilestoneReached,false);assert.ok(r.milestoneGaps.includes('TEN_K_CANONICAL_PRODUCTS'));assert.ok(r.milestoneGaps.includes('TWO_PLUS_HISTORY'));assert.ok(r.milestoneGaps.includes('THREE_PLUS_HISTORY'));
});

test('10k milestone passes only when volume and longitudinal targets are achieved',()=>{
 const universe={products:rows(10000,i=>i<1000?3:i<3000?2:1),metrics:{canonicalProducts:10000,sourceIdentityCoveragePct:80,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:13000,unboundObservations:500}};
 const r=buildDataQualityReport(universe,{longitudinalReady:3000,decisionEligibleSeries:2500});
 assert.equal(r.status,'TEN_K_MILESTONE_REACHED');assert.equal(r.scaleAuthorized,true);assert.equal(r.tenKMilestoneReached,true);assert.equal(r.milestoneGaps.length,0);assert.equal(r.purchaseAuthorized,false);
});

test('excess unbound observation share blocks scale entry',()=>{
 const universe={products:rows(1000,1),metrics:{canonicalProducts:1000,sourceIdentityCoveragePct:80,priceCoveragePct:70,reviewCoveragePct:70,categoryCoveragePct:95,boundObservations:1000,unboundObservations:1000}};
 const r=buildDataQualityReport(universe,{});assert.ok(r.blockers.includes('UNBOUND_OBSERVATIONS'));assert.equal(r.scaleAuthorized,false);
});
