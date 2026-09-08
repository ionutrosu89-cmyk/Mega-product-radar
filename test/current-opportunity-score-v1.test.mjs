import assert from 'node:assert/strict';
import test from 'node:test';
import {computeCurrentOpportunityScore} from '../current-opportunity-score-v1.js';

test('established brand keeps market signal but blocks commercial opportunity score',()=>{
  const result=computeCurrentOpportunityScore({title:'Avery Binder'},{ebayBestSellingRank:1,amazonReviewsPerDay:4,amazonEvidenceClass:'DERIVED',estimatedGrossMarginPct:60},{windowDays:7});
  assert.ok(result.marketSignalScore>0);
  assert.equal(result.currentOpportunityScore,null);
  assert.equal(result.decision,'STOP_BRAND_GATE');
  assert.equal(result.commercialEligible,false);
});

test('regulated or manual-review category cannot receive commercial opportunity score',()=>{
  const result=computeCurrentOpportunityScore({title:'Utility knife organizer kit'},{ebayBestSellingRank:3,romaniaGap01:.8},{windowDays:7});
  assert.equal(result.currentOpportunityScore,null);
  assert.equal(result.decision,'MANUAL_REVIEW');
  assert.equal(result.commercialEligible,false);
});

test('unknown signals stay zero and do not fabricate an opportunity',()=>{
  const result=computeCurrentOpportunityScore({title:'Generic desk organizer'},{},{windowDays:30});
  assert.equal(result.marketSignalScore,0);
  assert.equal(result.currentOpportunityScore,null);
  assert.equal(result.evidenceClass,'INSUFFICIENT_DATA');
  assert.equal(result.decision,'INSUFFICIENT_DATA');
});

test('two current derived signal families can create a provisional commercial score without sales claims',()=>{
  const result=computeCurrentOpportunityScore({title:'Generic phone stand'},{amazonReviewsPerDay:1.5,amazonEvidenceClass:'DERIVED',googleSearchStrength01:.7,googleEvidenceClass:'SEARCH_INTEREST_NOT_SALES',estimatedGrossMarginPct:45},{windowDays:7});
  assert.ok(result.currentOpportunityScore>0);
  assert.equal(result.evidenceClass,'DERIVED_MULTI_SOURCE');
  assert.equal(result.confidence,'MEDIUM');
  assert.equal(result.policy.noVerifiedSalesClaim,true);
});

test('direct eBay BEST_SELLING rank enables current score while remaining platform rank, not unit sales',()=>{
  const result=computeCurrentOpportunityScore({title:'Generic travel organizer'},{ebayBestSellingRank:5,ebayDaysObserved:5,ebayRankAcceleration01:.4,estimatedGrossMarginPct:50},{windowDays:7});
  assert.ok(result.currentOpportunityScore>0);
  assert.equal(result.evidenceClass,'DIRECT_PLUS_DERIVED');
  assert.equal(result.decision,'ELIGIBLE_CURRENT_OPPORTUNITY');
  assert.equal(result.policy.noVerifiedSalesClaim,true);
});
