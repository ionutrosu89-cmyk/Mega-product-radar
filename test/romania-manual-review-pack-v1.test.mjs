import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildRomaniaManualReviewPack,validateRomaniaManualReviewRow,reviewedRomaniaRowToSnapshot} from '../romania-manual-review-pack-v1.js';

const queue=JSON.parse(await fs.readFile(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));
const items=queue.items||[];

test('review pack creates exactly two direct marketplace tasks per priority niche',()=>{
  const pack=buildRomaniaManualReviewPack({queueItems:items});
  assert.equal(pack.totalTasks,6);
  assert.equal(pack.tasks.filter(x=>x.platform==='EMAG').length,3);
  assert.equal(pack.tasks.filter(x=>x.platform==='TRENDYOL').length,3);
  assert.equal(pack.paidCallsTriggered,0);
  assert.equal(pack.purchaseAuthorized,false);
});

test('known contaminated Trendyol quantities remain surface-only and canonical lower bounds stay unknown',()=>{
  const pack=buildRomaniaManualReviewPack({queueItems:items});
  const packing=pack.tasks.find(x=>x.nicheKey==='travel:packing-cubes'&&x.platform==='TRENDYOL');
  const trunk=pack.tasks.find(x=>x.nicheKey==='automotive:trunk-organization'&&x.platform==='TRENDYOL');
  assert.equal(packing.knownSurfaceItemCountLowerBound,656);
  assert.equal(packing.knownListingCountLowerBound,null);
  assert.equal(packing.knownExactListingCount,null);
  assert.equal(packing.review.listingCountLowerBound,null);
  assert.equal(trunk.knownSurfaceItemCountLowerBound,512);
  assert.equal(trunk.knownListingCountLowerBound,null);
  assert.equal(trunk.review.listingCount,null);
});

test('manual row fails closed when exact count or human scope confirmation is missing',()=>{
  const r=validateRomaniaManualReviewRow({
    nicheKey:'travel:packing-cubes',platform:'EMAG',comparabilityKey:'PACKING_CUBES_SET',
    observedAt:'2026-08-25T12:00:00Z',sourceUrl:'https://www.emag.ro/search/organizator-valiza-set',
    scope:'PUBLIC_MARKET_SURFACE',listingCount:null,listingCountLowerBound:24,
    manualReviewed:false,comparableScopeConfirmed:false
  });
  assert.equal(r.validForExactComparableEvidence,false);
  assert.ok(r.blockers.includes('MANUAL_REVIEW_REQUIRED'));
  assert.ok(r.blockers.includes('COMPARABLE_SCOPE_NOT_CONFIRMED'));
  assert.ok(r.blockers.includes('MARKET_WIDE_SCOPE_REQUIRED'));
  assert.ok(r.blockers.includes('EXACT_LISTING_COUNT_MISSING'));
});

test('third party source cannot become direct marketplace evidence',()=>{
  const r=validateRomaniaManualReviewRow({
    nicheKey:'travel:packing-cubes',platform:'EMAG',comparabilityKey:'PACKING_CUBES_SET',
    observedAt:'2026-08-25T12:00:00Z',sourceUrl:'https://www.pricy.ro/produs/example',
    scope:'MARKET_WIDE',listingCount:25,manualReviewed:true,comparableScopeConfirmed:true
  });
  assert.equal(r.validForExactComparableEvidence,false);
  assert.ok(r.blockers.includes('DIRECT_MARKETPLACE_SOURCE_REQUIRED'));
});

test('explicit canonical lower bound still constrains an exact reviewed count',()=>{
  const r=validateRomaniaManualReviewRow({
    nicheKey:'travel:packing-cubes',platform:'TRENDYOL',comparabilityKey:'PACKING_CUBES_SET',
    observedAt:'2026-08-25T12:00:00Z',sourceUrl:'https://www.trendyol.com/ro/organizatoare-pentru-valiza-x-c163720',
    scope:'MARKET_WIDE',listingCount:20,listingCountLowerBound:25,manualReviewed:true,comparableScopeConfirmed:true
  });
  assert.equal(r.validForExactComparableEvidence,false);
  assert.ok(r.blockers.includes('EXACT_COUNT_BELOW_OBSERVED_LOWER_BOUND'));
});

test('fully reviewed direct exact row becomes snapshot but never purchase authority',()=>{
  const out=reviewedRomaniaRowToSnapshot({
    nicheKey:'automotive:trunk-organization',platform:'TRENDYOL',comparabilityKey:'AUTO_TRUNK_ORGANIZERS',
    observedAt:'2026-08-25T12:00:00Z',sourceUrl:'https://www.trendyol.com/ro/organizatori-de-portbagaj-auto-x-c103894',
    scope:'MARKET_WIDE',listingCount:120,listingCountLowerBound:null,surfaceItemCountLowerBound:512,manualReviewed:true,comparableScopeConfirmed:true
  });
  assert.equal(out.promotableAsExactComparableEvidence,true);
  assert.equal(out.snapshot.comparabilityKey,'CAR_TRUNK_ORGANIZERS');
  assert.equal(out.snapshot.listingCount,120);
  assert.equal(out.snapshot.surfaceItemCountLowerBound,512);
  assert.equal(out.snapshot.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.paidCallsTriggered,0);
});
