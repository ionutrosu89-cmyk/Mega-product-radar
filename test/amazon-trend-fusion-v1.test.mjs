import test from 'node:test';
import assert from 'node:assert/strict';
import {fuseAmazonTrendEvidence} from '../amazon-trend-fusion-v1.js';

function review(overrides={}){
  return {
    identity:'AMAZON:B000000001',platform:'AMAZON',externalId:'B000000001',
    previousObservedAt:'2026-08-25T10:00:00.000Z',currentObservedAt:'2026-08-26T10:00:00.000Z',elapsedHours:24,
    reviewVelocityPerDay:12,reviewDelta:12,trendEvidenceLevel:'PRELIMINARY_REVIEW_PRICE_ONLY',
    salesEvidenceClass:'NOT_VERIFIED_SALES',...overrides
  };
}
function rank(overrides={}){
  return {
    externalId:'B000000001',sourceCategoryKey:'amazon:office-products:best-sellers',
    firstObservedAt:'2026-08-25T10:00:00.000Z',latestObservedAt:'2026-08-26T10:00:00.000Z',elapsedHours:24,
    intervalEligible:true,firstRank:20,latestRank:8,rankVelocityPerDay:12,
    trendEvidenceClass:'LONGITUDINAL_PUBLIC_RANKING',salesEvidenceClass:'NOT_VERIFIED_SALES',...overrides
  };
}

test('confirms acceleration only when eligible rank and review evidence agree',()=>{
  const out=fuseAmazonTrendEvidence({reviewEvidenceRows:[review()],rankingHistoryRows:[rank()]});
  assert.equal(out.eligible,1);
  assert.equal(out.confirmedAcceleration,1);
  assert.equal(out.rows[0].signal,'CONFIRMED_ACCELERATION');
  assert.equal(out.rows[0].demandEvidenceConfirmed,true);
  assert.equal(out.rows[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.rows[0].maximumFunnelContribution,'VALIDATE_SUPPORT_ONLY');
  assert.equal(out.rows[0].purchaseAuthorized,false);
});

test('review-only evidence cannot become fused trend confirmation',()=>{
  const out=fuseAmazonTrendEvidence({reviewEvidenceRows:[review()],rankingHistoryRows:[]});
  assert.equal(out.eligible,0);
  assert.equal(out.confirmedAcceleration,0);
  assert.equal(out.blocked[0].error,'RANK_LONGITUDINAL_EVIDENCE_MISSING');
});

test('rank-only evidence cannot become fused trend confirmation',()=>{
  const out=fuseAmazonTrendEvidence({reviewEvidenceRows:[],rankingHistoryRows:[rank()]});
  assert.equal(out.eligible,0);
  assert.equal(out.blocked[0].error,'REVIEW_LONGITUDINAL_EVIDENCE_MISSING');
});

test('short or non-longitudinal source rows are ignored',()=>{
  const out=fuseAmazonTrendEvidence({
    reviewEvidenceRows:[review({elapsedHours:12})],
    rankingHistoryRows:[rank({elapsedHours:12,intervalEligible:false,trendEvidenceClass:'SINGLE_OR_SHORT_INTERVAL_RANKING'})]
  });
  assert.equal(out.eligible,0);
  assert.equal(out.rows.length,0);
});

test('temporally distant endpoints fail closed',()=>{
  const out=fuseAmazonTrendEvidence({
    reviewEvidenceRows:[review({currentObservedAt:'2026-08-30T10:00:00.000Z'})],
    rankingHistoryRows:[rank()],maxEndpointSkewHours:48
  });
  assert.equal(out.eligible,0);
  assert.equal(out.blocked[0].error,'EVIDENCE_ENDPOINTS_NOT_COMPARABLE');
});

test('positive review velocity with worsening rank is mixed, not confirmed acceleration',()=>{
  const out=fuseAmazonTrendEvidence({reviewEvidenceRows:[review()],rankingHistoryRows:[rank({firstRank:8,latestRank:20,rankVelocityPerDay:-12})]});
  assert.equal(out.eligible,1);
  assert.equal(out.confirmedAcceleration,0);
  assert.equal(out.rows[0].signal,'MIXED_SIGNAL');
  assert.equal(out.rows[0].trendScore,null);
  assert.equal(out.rows[0].demandEvidenceConfirmed,false);
});

test('flat reviews plus improving rank stays below confirmed acceleration',()=>{
  const out=fuseAmazonTrendEvidence({reviewEvidenceRows:[review({reviewVelocityPerDay:0,reviewDelta:0})],rankingHistoryRows:[rank()]});
  assert.equal(out.rows[0].signal,'RANK_IMPROVING_REVIEWS_FLAT');
  assert.equal(out.rows[0].trendScore,null);
  assert.equal(out.rows[0].demandEvidenceConfirmed,false);
});

test('fusion never upgrades evidence to verified sales or purchase authorization',()=>{
  const out=fuseAmazonTrendEvidence({reviewEvidenceRows:[review()],rankingHistoryRows:[rank()]});
  assert.equal(out.verifiedSalesRows,0);
  assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.purchaseAuthorized,false);
});
