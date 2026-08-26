import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRomaniaGapV2} from '../romania-gap-v2.js';
import {THREE_RING_ROUND_BINDER_PROFILE_V2} from '../romania-semantic-comparability-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const query={platform:'TRENDYOL',coverageClass:'EXHAUSTIVE_QUERY',observedAt:'2026-08-26T10:00:00Z',source:'MANUAL_PRODUCT_LEVEL_REVIEW',sourceUrl:'https://example.test',scope:'QUERY_SURFACE'};
const demand={score:75,evidenceClass:'DIRECT_OBSERVED'};

test('semantic contradictions remove false-positive two-ring binders from comparable supply',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:query,localDemandEvidence:demand,comparabilityProfile:THREE_RING_ROUND_BINDER_PROFILE_V2,listings:[
  {listingId:'1',title:'Binder 2 inele'},
  {listingId:'2',title:'Dosar 2 inele'},
  {listingId:'3',title:'Biblioraft 2 inele'}
 ]});
 assert.equal(r.comparableListingCount,0);
 assert.equal(r.unknownComparabilityCount,0);
 assert.equal(r.semanticComparability.counts.NOT_COMPARABLE,3);
 assert.equal(r.marketWideClaimAllowed,false);
});

test('generic title remains unresolved and blocks PASS',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:query,localDemandEvidence:demand,comparabilityProfile:THREE_RING_ROUND_BINDER_PROFILE_V2,listings:[{listingId:'x',title:'Organizator documente premium'}]});
 assert.equal(r.unknownComparabilityCount,1);
 assert.equal(r.gateStatus,'REVIEW');
});

test('explicit three-ring listing is counted once as exact competition',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:query,localDemandEvidence:demand,comparabilityProfile:THREE_RING_ROUND_BINDER_PROFILE_V2,listings:[{listingId:'x',title:'Binder A4 3 inele',priceRon:89,reviewCount:12,sellerId:'s1'}]});
 assert.equal(r.comparableListingCount,1);
 assert.equal(r.comparableListings[0].comparability,'EXACT');
});
