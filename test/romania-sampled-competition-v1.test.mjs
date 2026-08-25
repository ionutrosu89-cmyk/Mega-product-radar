import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveRomaniaSampledCompetition,combineRomaniaSampledCompetition} from '../romania-sampled-competition-v1.js';

test('reviewed Trendyol trunk sample produces an estimate but never exact competition',()=>{
  const r=deriveRomaniaSampledCompetition({
    platform:'TRENDYOL',surfaceItemCountLowerBound:512,sampleSize:20,canonicalMatches:5,
    sourceScope:'PUBLIC_MARKET_SURFACE',manualReviewed:true,observedAt:'2026-08-25T11:34:00Z'
  });
  assert.equal(r.eligibleForSampledSignal,true);
  assert.equal(r.samplePurity,0.25);
  assert.equal(r.canonicalListingEstimate,128);
  assert.ok(r.canonicalListingEstimateLow<128);
  assert.ok(r.canonicalListingEstimateHigh>128);
  assert.equal(r.exactComparableCount,false);
  assert.equal(r.romaniaGapExactGateSatisfied,false);
  assert.deepEqual(r.allowedFunnelUse,['DISCOVERED','PROMISING']);
  assert.ok(r.forbiddenFunnelUse.includes('FINALIST'));
});

test('reviewed packing-cubes sample remains explicitly estimated',()=>{
  const r=deriveRomaniaSampledCompetition({
    platform:'TRENDYOL',surfaceItemCountLowerBound:656,sampleSize:20,canonicalMatches:12,
    sourceScope:'PUBLIC_MARKET_SURFACE',manualReviewed:true,observedAt:'2026-08-25T11:45:00Z'
  });
  assert.equal(r.eligibleForSampledSignal,true);
  assert.equal(r.samplePurity,0.6);
  assert.equal(r.canonicalListingEstimate,394);
  assert.equal(r.evidenceClass,'DERIVED_FROM_REVIEWED_PUBLIC_SAMPLE');
  assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('missing count or human review fails closed instead of becoming zero',()=>{
  const r=deriveRomaniaSampledCompetition({platform:'EMAG',surfaceItemCountLowerBound:null,sampleSize:20,canonicalMatches:8,manualReviewed:false,observedAt:'2026-08-25T11:45:00Z'});
  assert.equal(r.eligibleForSampledSignal,false);
  assert.equal(r.surfaceItemCountLowerBound,null);
  assert.equal(r.canonicalListingEstimate,null);
  assert.ok(r.blockers.includes('SURFACE_COUNT_MISSING'));
  assert.ok(r.blockers.includes('MANUAL_REVIEW_REQUIRED'));
});

test('combined sample signal never satisfies exact Romania Gap gate',()=>{
  const r=combineRomaniaSampledCompetition([
    {platform:'EMAG',surfaceItemCountLowerBound:100,sampleSize:20,canonicalMatches:10,sourceScope:'PUBLIC_MARKET_SURFACE',manualReviewed:true,observedAt:'2026-08-25T11:45:00Z'},
    {platform:'TRENDYOL',surfaceItemCountLowerBound:200,sampleSize:20,canonicalMatches:10,sourceScope:'PUBLIC_MARKET_SURFACE',manualReviewed:true,observedAt:'2026-08-25T11:45:00Z'}
  ]);
  assert.equal(r.status,'MULTI_PLATFORM_ESTIMATE');
  assert.equal(r.estimatedCanonicalListings,150);
  assert.equal(r.exactComparableCount,false);
  assert.equal(r.romaniaGapExactGateSatisfied,false);
  assert.ok(r.forbiddenFunnelUse.includes('VALIDATE'));
  assert.ok(r.forbiddenFunnelUse.includes('TEST_READY'));
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.purchaseAuthorized,false);
});
