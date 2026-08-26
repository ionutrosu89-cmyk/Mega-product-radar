import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeOpportunityV5,opportunityWeightAuditV5} from '../opportunity-v5.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const demand={canonicalProductId:A,score:85,confidence:80,evidenceClass:'DIRECT_OBSERVED',status:'PASS'};
const trend={canonicalProductId:A,trendScore:80,confidence:75,evidenceClass:'DERIVED',gateStatus:'PASS'};
const gap={canonicalProductId:A,gapScore:85,confidence:80,evidenceClass:'DERIVED',gateStatus:'PASS'};
const importability={canonicalProductId:A,status:'PASS',confidence:85,evidenceClass:'DERIVED'};
const supplier={canonicalProductId:A,status:'PASS',confidence:80,evidenceClass:'DERIVED'};
const economics={canonicalProductId:A,status:'PASS',confidence:80,evidenceClass:'DERIVED'};
const packet=overrides=>({canonicalProductId:A,globalDemand:demand,trend,romaniaGap:gap,importability,supplier,economics,...overrides});

test('canonical weights sum to 100',()=>{const r=opportunityWeightAuditV5();assert.equal(r.total,100);assert.equal(r.valid,true);});

test('all pre-test gates pass can recommend FINALIST but never TEST_READY or BUY_READY',()=>{
 const r=analyzeOpportunityV5(packet());
 assert.equal(r.recommendation,'FINALIST');assert.equal(r.finalistEligible,true);assert.equal(r.testReadyEligible,false);assert.equal(r.buyReadyEligible,false);assert.equal(r.purchaseAuthorized,false);assert.equal(r.automaticPurchaseAllowed,false);
});

test('score cannot compensate for Romania Gap review',()=>{
 const r=analyzeOpportunityV5(packet({globalDemand:{...demand,score:100},trend:{...trend,trendScore:100},romaniaGap:{...gap,gapScore:100,gateStatus:'REVIEW'}}));
 assert.notEqual(r.recommendation,'FINALIST');assert.equal(r.recommendation,'VALIDATE');assert.ok(r.blockers.includes('ROMANIAGAP_NOT_PASS'));
});

test('importability BLOCKED overrides otherwise excellent components',()=>{
 const r=analyzeOpportunityV5(packet({importability:{...importability,status:'BLOCKED'}}));
 assert.equal(r.recommendation,'VALIDATE');assert.ok(r.blockers.includes('IMPORTABILITY_BLOCKED'));assert.equal(r.finalistEligible,false);
});

test('missing supplier evidence cannot create a fake score or FINALIST',()=>{
 const r=analyzeOpportunityV5(packet({supplier:{}}));
 assert.equal(r.opportunityScore,null);assert.ok(r.missingComponents.includes('supplier'));assert.equal(r.recommendation,'VALIDATE');
});

test('cross-product economics evidence is rejected',()=>{
 const r=analyzeOpportunityV5(packet({economics:{...economics,canonicalProductId:B}}));
 assert.ok(r.identityMismatches.includes('economics'));assert.ok(r.blockers.includes('CROSS_PRODUCT_EVIDENCE_REJECTED'));assert.notEqual(r.recommendation,'FINALIST');
});

test('high opportunity with low confidence remains VALIDATE',()=>{
 const low={canonicalProductId:A,score:100,confidence:10,evidenceClass:'DIRECT_OBSERVED',status:'PASS'};
 const r=analyzeOpportunityV5({canonicalProductId:A,globalDemand:low,trend:{...trend,trendScore:100,confidence:10},romaniaGap:{...gap,gapScore:100,confidence:10},importability:{...importability,confidence:10},supplier:{...supplier,confidence:10},economics:{...economics,confidence:10}});
 assert.ok(r.opportunityScore>=60);assert.ok(r.confidence<50);assert.equal(r.recommendation,'VALIDATE');
});

test('legacy BUY is explicitly non-authoritative',()=>{
 const r=analyzeOpportunityV5(packet({legacyRecommendation:'BUY',romaniaGap:{...gap,gateStatus:'REVIEW'}}));
 assert.equal(r.legacyRecommendationAuthoritative,false);assert.notEqual(r.recommendation,'FINALIST');assert.equal(r.purchaseAuthorized,false);
});

test('Opportunity V5 never infers verified sales',()=>{
 const r=analyzeOpportunityV5(packet());assert.equal(r.verifiedSales,null);assert.equal(r.salesEvidenceClass,'NOT_INFERRED_BY_OPPORTUNITY_ENGINE');
});
