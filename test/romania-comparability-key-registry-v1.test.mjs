import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalRomaniaComparabilityKey,comparabilityKeysEquivalent} from '../romania-comparability-key-registry-v1.js';
import {normalizeRomaniaMarketSnapshot,buildRomaniaMarketSnapshotHistory} from '../romania-market-snapshot-ledger-v1.js';
import {validateRomaniaEvidencePromotion} from '../romania-evidence-promotion-validator-v1.js';

test('legacy packing-cubes and trunk keys canonicalize to review-queue keys',()=>{
  assert.equal(canonicalRomaniaComparabilityKey('TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS'),'PACKING_CUBES_SET');
  assert.equal(canonicalRomaniaComparabilityKey('AUTO_TRUNK_ORGANIZERS'),'CAR_TRUNK_ORGANIZERS');
  assert.equal(comparabilityKeysEquivalent('AUTO_TRUNK_ORGANIZERS','CAR_TRUNK_ORGANIZERS'),true);
});

test('ledger groups legacy and canonical aliases into one history',()=>{
  const ledger={observations:[
    {nicheKey:'travel:packing-cubes',platform:'TRENDYOL',market:'RO',comparabilityKey:'TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS',observedAt:'2026-08-05T23:15:00Z',sourceUrl:'https://example.com/a',listingCountLowerBound:656},
    {nicheKey:'travel:packing-cubes',platform:'TRENDYOL',market:'RO',comparabilityKey:'PACKING_CUBES_SET',observedAt:'2026-08-25T07:00:00Z',sourceUrl:'https://example.com/b',listingCountLowerBound:700}
  ]};
  const h=buildRomaniaMarketSnapshotHistory(ledger);
  assert.equal(h.histories.length,1);
  assert.equal(h.histories[0].comparabilityKey,'PACKING_CUBES_SET');
  assert.equal(h.histories[0].observations,2);
  assert.equal(h.histories[0].exactCountDelta,null);
});

test('promotion validator accepts known semantic aliases but still blocks lower bounds',()=>{
  const x=validateRomaniaEvidencePromotion({
    queueItem:{nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET'},
    emagProbe:{comparabilityKey:'PACKING_CUBES_SET',observedAt:'2026-08-25T07:00:00Z',listingCount:null,listingCountLowerBound:20,manualReviewed:true,comparableScopeConfirmed:true,scope:'MARKET_WIDE'},
    trendyolEvidence:{comparabilityKey:'TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS',observedAt:'2026-08-05T23:15:00Z',listingCount:null,listingCountLowerBound:656,manualReviewed:true,comparableScopeConfirmed:true,scope:'MARKET_WIDE'}
  });
  assert.equal(x.blockers.includes('TRENDYOL_COMPARABILITY_KEY_MISMATCH'),false);
  assert.equal(x.promotable,false);
  assert.ok(x.blockers.includes('EMAG_LOWER_BOUND_NOT_EXACT'));
  assert.ok(x.blockers.includes('TRENDYOL_LOWER_BOUND_NOT_EXACT'));
});

test('unknown non-equivalent key still fails closed',()=>{
  const x=normalizeRomaniaMarketSnapshot({nicheKey:'x',platform:'EMAG',market:'RO',comparabilityKey:'UNKNOWN_SCOPE',observedAt:'2026-08-25T07:00:00Z',sourceUrl:'https://example.com'});
  assert.equal(x.comparabilityKey,'UNKNOWN_SCOPE');
  const p=validateRomaniaEvidencePromotion({
    queueItem:{nicheKey:'x',comparabilityKey:'PACKING_CUBES_SET'},
    emagProbe:{comparabilityKey:'UNKNOWN_SCOPE'},
    trendyolEvidence:{comparabilityKey:'PACKING_CUBES_SET'}
  });
  assert.ok(p.blockers.includes('EMAG_COMPARABILITY_KEY_MISMATCH'));
});
