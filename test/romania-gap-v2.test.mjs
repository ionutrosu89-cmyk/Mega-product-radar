import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRomaniaGapV2} from '../romania-gap-v2.js';

const A='11111111-1111-4111-8111-111111111111';
const baseQuery={platform:'TRENDYOL',coverageClass:'EXHAUSTIVE_QUERY',observedAt:'2026-08-26T10:00:00Z',source:'TRENDYOL_MANUAL_REVIEW',sourceUrl:'https://example.test/search',scope:'QUERY_SURFACE'};
const demand={score:72,evidenceClass:'DIRECT_OBSERVED'};

test('zero exact comparables on one reviewed query surface is not market-wide zero',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:baseQuery,listings:[
  {listingId:'1',comparability:'NOT_COMPARABLE',evidenceClass:'MANUALLY_VERIFIED'},
  {listingId:'2',comparability:'NOT_COMPARABLE',evidenceClass:'MANUALLY_VERIFIED'}
 ],localDemandEvidence:demand});
 assert.equal(r.comparableListingCount,0);
 assert.equal(r.marketWideClaimAllowed,false);
 assert.match(r.policy,/ZERO_ON_REVIEWED_SURFACE_IS_NOT_MARKET_WIDE_ZERO/);
});

test('estimated coverage cannot PASS even with high derived gap score',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:{...baseQuery,coverageClass:'ESTIMATED'},listings:[],localDemandEvidence:{score:95,evidenceClass:'DIRECT_OBSERVED'}});
 assert.equal(r.gateStatus,'REVIEW');
 assert.ok(r.confidence<=50);
 assert.ok(r.reasons.includes('ESTIMATED_COVERAGE_CANNOT_PROVE_GAP'));
});

test('variant duplicates are counted once',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:baseQuery,listings:[
  {listingId:'1-red',variantKey:'product-1',sellerId:'S1',brand:'B',priceRon:100,reviewCount:20,comparability:'COMPARABLE'},
  {listingId:'1-blue',variantKey:'product-1',sellerId:'S1',brand:'B',priceRon:110,reviewCount:25,comparability:'COMPARABLE'},
  {listingId:'2',variantKey:'product-2',sellerId:'S2',brand:'C',priceRon:130,reviewCount:40,comparability:'EXACT'}
 ],localDemandEvidence:demand});
 assert.equal(r.comparableListingCount,2);
 assert.equal(r.sellerCount,2);
 assert.equal(r.brandCount,2);
});

test('unknown listing comparability forces review',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:baseQuery,listings:[
  {listingId:'1',comparability:'UNKNOWN'},
  {listingId:'2',comparability:'NOT_COMPARABLE'}
 ],localDemandEvidence:demand});
 assert.equal(r.gateStatus,'REVIEW');
 assert.ok(r.reasons.includes('UNKNOWN_LISTING_COMPARABILITY_REMAINS'));
});

test('supported low local supply plus direct demand can PASS only as gap evidence',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:baseQuery,listings:[
  {listingId:'1',sellerId:'S1',brand:'B',priceRon:120,reviewCount:15,comparability:'EXACT',evidenceClass:'MANUALLY_VERIFIED'}
 ],localDemandEvidence:{score:80,evidenceClass:'DIRECT_OBSERVED'}});
 assert.equal(r.gateStatus,'PASS');
 assert.ok(r.gapScore>=65);
 assert.ok(r.confidence>=60);
 assert.equal(r.canPromoteToFinalist,false);
 assert.equal(r.purchaseAuthorized,false);
});

test('missing local demand stays review even when local supply looks empty',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:baseQuery,listings:[]});
 assert.equal(r.gateStatus,'REVIEW');
 assert.equal(r.localDemandScore,null);
 assert.ok(r.reasons.includes('LOCAL_DEMAND_EVIDENCE_MISSING'));
});

test('missing canonical identity fails closed',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:null,queryEvidence:baseQuery,listings:[],localDemandEvidence:demand});
 assert.equal(r.gateStatus,'UNKNOWN');
 assert.equal(r.decisionEligible,false);
 assert.ok(r.reasons.includes('CANONICAL_PRODUCT_ID_REQUIRED'));
});

test('missing platform fails closed',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:{...baseQuery,platform:null},listings:[],localDemandEvidence:demand});
 assert.equal(r.gateStatus,'UNKNOWN');
 assert.ok(r.reasons.includes('PLATFORM_REQUIRED'));
});

test('market-wide claim requires exhaustive query plus explicit market-wide verification',()=>{
 const r=analyzeRomaniaGapV2({canonicalProductId:A,queryEvidence:{...baseQuery,scope:'MARKET_WIDE',marketWideVerified:true},listings:[],localDemandEvidence:demand});
 assert.equal(r.marketWideClaimAllowed,true);
});
