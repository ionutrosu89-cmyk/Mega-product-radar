import test from 'node:test';
import assert from 'node:assert/strict';
import preflight from '../data/romania-gap-preflight-b00inkvs82-v1.json' with {type:'json'};
import {EMAG_PUBLIC_SEARCH_TARGETS,buildEmagSearchUrl} from '../emag-public-search-probe.js';

test('priority Amazon leader is staged for Romania preflight without promotion',()=>{
  assert.equal(preflight.candidate.externalId,'B00INKVS82');
  assert.equal(preflight.candidate.evidenceBasis.reviewDelta,14);
  assert.equal(preflight.candidate.evidenceBasis.rankTrendReady,false);
  assert.equal(preflight.candidate.evidenceBasis.confirmedTrendFusion,false);
  assert.equal(preflight.promotion.exactRomaniaGapConfirmed,false);
  assert.equal(preflight.promotion.promotionEligible,false);
  assert.equal(preflight.promotion.maximumFunnelContributionNow,'DISCOVERED_SUPPORT_ONLY');
});

test('Romania preflight preserves unknown exact counts as null',()=>{
  for(const platform of ['EMAG','TRENDYOL']){
    const evidence=preflight.knownEvidence[platform];
    assert.equal(evidence.listingCount,null);
    assert.equal(evidence.listingCountLowerBound,null);
    assert.equal(evidence.sourceUrl,null);
    assert.equal(evidence.observedAt,null);
    assert.equal(evidence.marketWideReviewed,false);
  }
  assert.equal(preflight.policy.unknownIsZero,false);
  assert.equal(preflight.policy.lowerBoundIsExactCount,false);
  assert.equal(preflight.policy.sampledEvidenceCanReachValidate,false);
});

test('eMAG public probe includes the binder preflight target but cannot make counts trusted',()=>{
  const target=EMAG_PUBLIC_SEARCH_TARGETS.find(x=>x.nicheKey==='office:three-ring-binders');
  assert.ok(target);
  assert.equal(target.comparabilityKey,'THREE_RING_ROUND_RING_BINDERS');
  assert.equal(target.query,'biblioraft 3 inele');
  assert.match(buildEmagSearchUrl(target.query),/^https:\/\/www\.emag\.ro\/search\//);
});

test('preflight cannot fabricate sales spend or purchase authority',()=>{
  assert.equal(preflight.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(preflight.policy.providerSpendEur,0);
  assert.equal(preflight.policy.paidCallsTriggered,0);
  assert.equal(preflight.policy.purchaseAuthorized,false);
});
