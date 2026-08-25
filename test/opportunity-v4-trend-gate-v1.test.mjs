import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateOpportunityV4} from '../opportunity-engine-v4.js';

const exactRomania={status:'READY',score:80,romaniaGapExactGateSatisfied:true,exactComparableCount:true};
const strongMarket={trend:{score:90,confidence:90},romaniaGap:exactRomania,dataConfidence:85};
const confirmedFusion={signal:'CONFIRMED_ACCELERATION',evidenceClass:'FUSED_LONGITUDINAL_PUBLIC_TREND',trendEvidenceLevel:'RANK_PLUS_REVIEW_LONGITUDINAL',demandEvidenceConfirmed:true,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false};

test('review-only longitudinal evidence is capped at PROMISING',()=>{
  const out=calculateOpportunityV4({...strongMarket,amazonTrendFusion:{signal:'REVIEWS_INCREASING',evidenceClass:'LONGITUDINAL_PUBLIC_PRODUCT_PAGE',trendEvidenceLevel:'PRELIMINARY_REVIEW_PRICE_ONLY',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false}});
  assert.equal(out.funnelStage,'PROMISING');
  assert.equal(out.trendEvidence.confirmedAcceleration,false);
  assert.ok(out.blockers.includes('CONFIRMED_LONGITUDINAL_TREND_REQUIRED_FOR_VALIDATION'));
  assert.ok(out.blockers.includes('PRELIMINARY_TREND_EVIDENCE_MAX_PROMISING'));
});

test('rank-only longitudinal evidence is capped at PROMISING',()=>{
  const out=calculateOpportunityV4({...strongMarket,amazonTrendFusion:{signal:'RANK_IMPROVING',evidenceClass:'LONGITUDINAL_PUBLIC_RANKING',trendEvidenceLevel:'RANK_LONGITUDINAL_ONLY',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false}});
  assert.equal(out.funnelStage,'PROMISING');
  assert.equal(out.trendEvidence.confirmedAcceleration,false);
});

test('confirmed rank plus review fusion can support VALIDATE with exact Romania evidence',()=>{
  const out=calculateOpportunityV4({...strongMarket,amazonTrendFusion:confirmedFusion});
  assert.equal(out.funnelStage,'VALIDATE');
  assert.equal(out.trendEvidence.confirmedAcceleration,true);
  assert.equal(out.purchaseAuthorized,false);
});

test('a forged CONFIRMED_ACCELERATION label without the fusion contract cannot pass',()=>{
  const out=calculateOpportunityV4({...strongMarket,amazonTrendFusion:{signal:'CONFIRMED_ACCELERATION',evidenceClass:'LONGITUDINAL_PUBLIC_PRODUCT_PAGE',trendEvidenceLevel:'PRELIMINARY_REVIEW_PRICE_ONLY',demandEvidenceConfirmed:true,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false}});
  assert.equal(out.funnelStage,'PROMISING');
  assert.equal(out.trendEvidence.confirmedAcceleration,false);
});

test('FINALIST requires confirmed trend, exact Romania, verified supplier and confirmed economics',()=>{
  const out=calculateOpportunityV4({...strongMarket,amazonTrendFusion:confirmedFusion,supplier:{verifiedQuote:true},economics:{landedCostConfirmed:true,marginPct:30,roiPct:70,profitPerUnit:20}});
  assert.equal(out.funnelStage,'FINALIST');
  assert.equal(out.supplierReady,true);
  assert.equal(out.economicsReady,true);
  assert.equal(out.romaniaEvidence.exactReady,true);
  assert.equal(out.trendEvidence.confirmedAcceleration,true);
  assert.equal(out.purchaseAuthorized,false);
});

test('sampled Romania still caps confirmed trend at PROMISING',()=>{
  const out=calculateOpportunityV4({trend:{score:90,confidence:90},amazonTrendFusion:confirmedFusion,romaniaGap:{status:'READY',romaniaGapExactGateSatisfied:false,evidenceClass:'SAMPLED_ESTIMATE'},romaniaSampledCompetition:{eligibleForSampledSignal:true,status:'SINGLE_PLATFORM_ESTIMATE'},dataConfidence:85});
  assert.equal(out.funnelStage,'PROMISING');
  assert.ok(out.blockers.includes('ROMANIA_EXACT_EVIDENCE_REQUIRED_FOR_VALIDATION'));
});
