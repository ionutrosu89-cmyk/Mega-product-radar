import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateOpportunityV4,buildOpportunityShortlistV4} from '../opportunity-engine-v4.js';

const strongBase={
  trend:{score:90,confidence:90},
  supplier:{verifiedQuote:true,evidenceClass:'MANUALLY_VERIFIED',quoteCount:3,benchmarkConfidence:85,documentationCoveragePct:90},
  economics:{landedCostConfirmed:true,marginPct:32,roiPct:110,profitPerUnit:28},
  dataConfidence:90,
  testGateReady:true,
  complianceGateReady:true
};

test('sampled Romania evidence can support PROMISING but cannot unlock VALIDATE or above',()=>{
  const r=calculateOpportunityV4({
    ...strongBase,
    romaniaGap:{status:'READY',score:90,romaniaGapExactGateSatisfied:false,evidenceClass:'DERIVED_ESTIMATE'},
    romaniaSampledCompetition:{status:'SINGLE_PLATFORM_ESTIMATE',eligibleForSampledSignal:true,evidenceClass:'DERIVED_FROM_REVIEWED_PUBLIC_SAMPLE'}
  });
  assert.ok(r.marketOpportunityScore>=65);
  assert.equal(r.funnelStage,'PROMISING');
  assert.equal(r.romaniaEvidence.exactReady,false);
  assert.equal(r.romaniaEvidence.sampledEligible,true);
  assert.equal(r.romaniaEvidence.maxFunnelStage,'PROMISING');
  assert.ok(r.blockers.includes('ROMANIA_EXACT_EVIDENCE_REQUIRED_FOR_VALIDATION'));
  assert.ok(r.blockers.includes('ROMANIA_SAMPLED_EVIDENCE_PRELIMINARY_ONLY'));
  assert.equal(r.purchaseAuthorized,false);
});

test('exact comparable Romania evidence preserves advanced funnel progression',()=>{
  const r=calculateOpportunityV4({
    ...strongBase,
    romaniaGap:{status:'READY',score:90,romaniaGapExactGateSatisfied:true,exactComparableCount:true,evidenceClass:'VERIFIED'}
  });
  assert.equal(r.funnelStage,'TEST_READY');
  assert.equal(r.romaniaEvidence.exactReady,true);
  assert.equal(r.romaniaEvidence.maxFunnelStage,'TEST_READY');
  assert.equal(r.blockers.includes('ROMANIA_EXACT_EVIDENCE_REQUIRED_FOR_VALIDATION'),false);
  assert.equal(r.purchaseAuthorized,false);
});

test('legacy READY Romania Gap without sampled or non-exact markers remains backward compatible',()=>{
  const r=calculateOpportunityV4({
    ...strongBase,
    romaniaGap:{status:'READY',score:90}
  });
  assert.equal(r.romaniaEvidence.exactReady,true);
  assert.equal(r.funnelStage,'TEST_READY');
});

test('unknown data confidence stays null instead of becoming zero',()=>{
  const input={...strongBase};
  delete input.dataConfidence;
  const r=calculateOpportunityV4({
    ...input,
    romaniaGap:{status:'READY',score:90,romaniaGapExactGateSatisfied:false,evidenceClass:'DERIVED_ESTIMATE'},
    romaniaSampledCompetition:{eligibleForSampledSignal:true,evidenceClass:'DERIVED_FROM_REVIEWED_PUBLIC_SAMPLE'}
  });
  assert.equal(r.dataConfidence,null);
  assert.equal(r.funnelStage,'PROMISING');
});

test('shortlist cannot contain a sampled-only FINALIST even with perfect supplier and economics',()=>{
  const sampled={
    ...strongBase,
    productKey:'sampled-product',
    romaniaGap:{status:'READY',score:95,romaniaGapExactGateSatisfied:false,evidenceClass:'DERIVED_ESTIMATE'},
    romaniaSampledCompetition:{status:'MULTI_PLATFORM_ESTIMATE',eligibleForSampledSignal:true,evidenceClass:'DERIVED_ESTIMATE'}
  };
  const exact={
    ...strongBase,
    productKey:'exact-product',
    romaniaGap:{status:'READY',score:90,romaniaGapExactGateSatisfied:true,exactComparableCount:true}
  };
  const r=buildOpportunityShortlistV4([sampled,exact]);
  const sampledOut=r.rows.find(x=>x.productKey==='sampled-product');
  const exactOut=r.rows.find(x=>x.productKey==='exact-product');
  assert.equal(sampledOut.funnelStage,'PROMISING');
  assert.equal(exactOut.funnelStage,'TEST_READY');
  assert.equal(r.finalists,1);
  assert.equal(r.purchaseAuthorized,false);
});
