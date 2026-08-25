import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRomaniaEnumeration } from '../romania-exhaustive-enumeration-v1.js';

const pages=[{listings:[{listingId:'a',canonicalMatch:true},{listingId:'b',canonicalMatch:false}]},{listings:[{listingId:'c',canonicalMatch:true},{listingId:'a',canonicalMatch:true}]}];

test('exhaustive reviewed pagination can produce surface-exact count only',()=>{
 const x=evaluateRomaniaEnumeration({platform:'TRENDYOL',query:'organizator cabluri sub birou',pages,allPagesReviewed:true,terminalPageConfirmed:true,manualCanonicalReview:true,queryScopeConfirmed:false,aliasesComplete:false});
 assert.equal(x.uniqueListingCount,3);
 assert.equal(x.canonicalSurfaceCount,2);
 assert.equal(x.surfaceExact,true);
 assert.equal(x.marketComparableExact,false);
 assert.ok(x.blockers.includes('QUERY_SCOPE_NOT_CONFIRMED'));
});

test('market comparable exact requires confirmed query scope and complete alias coverage',()=>{
 const x=evaluateRomaniaEnumeration({platform:'EMAG',query:'exact canonical union',pages,allPagesReviewed:true,terminalPageConfirmed:true,manualCanonicalReview:true,queryScopeConfirmed:true,aliasesComplete:true});
 assert.equal(x.surfaceExact,true);
 assert.equal(x.marketComparableExact,true);
 assert.equal(x.evidenceClass,'EXACT_COMPARABLE_CANONICAL_QUERY_UNION');
 assert.equal(x.purchaseAuthorized,false);
});

test('partial pagination fails closed and does not fabricate zero',()=>{
 const x=evaluateRomaniaEnumeration({platform:'EMAG',query:'x',pages:[],allPagesReviewed:false,terminalPageConfirmed:false,manualCanonicalReview:false});
 assert.equal(x.canonicalSurfaceCount,null);
 assert.equal(x.surfaceExact,false);
 assert.equal(x.marketComparableExact,false);
});

test('dedupe prevents duplicate listings from inflating exact surface count',()=>{
 const x=evaluateRomaniaEnumeration({platform:'TRENDYOL',query:'x',pages,allPagesReviewed:true,terminalPageConfirmed:true,manualCanonicalReview:true,queryScopeConfirmed:true,aliasesComplete:true});
 assert.equal(x.uniqueListingCount,3);
 assert.equal(x.canonicalSurfaceCount,2);
});
