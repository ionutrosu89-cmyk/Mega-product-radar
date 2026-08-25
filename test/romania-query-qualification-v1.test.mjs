import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifyRomaniaComparableQuery,buildRomaniaQueryQualificationReport} from '../romania-query-qualification-v1.js';

const clean=Array.from({length:10},(_,i)=>({title:`Organizator portbagaj pliabil ${i+1}`,canonicalMatch:true}));
const noisy=[...Array.from({length:8},(_,i)=>({title:`Suport laptop reglabil ${i+1}`,canonicalMatch:true})),{title:'Cooler laptop RGB',canonicalMatch:false,exclusionReason:'COOLER_ONLY'},{title:'Masa laptop pat',canonicalMatch:false,exclusionReason:'LAPTOP_TABLE'}];

test('clean query-scoped sample can become comparable count candidate but never exact evidence',()=>{
  const r=qualifyRomaniaComparableQuery({platform:'EMAG',query:'organizator portbagaj pliabil',declaredCount:42,countScope:'QUERY_SCOPED',sampleResults:clean});
  assert.equal(r.qualifiedForComparableCountCandidate,true);
  assert.equal(r.canonicalListingCountLowerBoundCandidate,42);
  assert.equal(r.exactComparableCount,false);
  assert.equal(r.manualExactReviewRequired,true);
  assert.equal(r.purchaseAuthorized,false);
});

test('unknown declared count remains unknown and never becomes zero',()=>{
  const r=qualifyRomaniaComparableQuery({platform:'EMAG',query:'organizator portbagaj pliabil',declaredCount:null,countScope:'UNKNOWN',sampleResults:clean});
  assert.equal(r.declaredCount,null);
  assert.equal(r.canonicalListingCountLowerBoundCandidate,null);
  assert.equal(r.qualifiedForComparableCountCandidate,false);
  assert.ok(r.blockers.includes('DECLARED_COUNT_MISSING_OR_INVALID'));
});

test('category total is rejected even with a clean visible sample',()=>{
  const r=qualifyRomaniaComparableQuery({platform:'EMAG',query:'organizator portbagaj pliabil',declaredCount:4194,countScope:'CATEGORY_TOTAL',sampleResults:clean});
  assert.equal(r.qualifiedForComparableCountCandidate,false);
  assert.ok(r.blockers.includes('DECLARED_COUNT_NOT_QUERY_SCOPED'));
  assert.equal(r.canonicalListingCountLowerBoundCandidate,null);
});

test('contaminated visible sample is rejected even when count claims query scope',()=>{
  const r=qualifyRomaniaComparableQuery({platform:'TRENDYOL',query:'suport laptop reglabil',declaredCount:100,countScope:'QUERY_SCOPED',sampleResults:noisy});
  assert.equal(r.purity,0.8);
  assert.equal(r.qualifiedForComparableCountCandidate,false);
  assert.ok(r.blockers.includes('SAMPLE_PURITY_BELOW_THRESHOLD'));
});

test('sample smaller than ten fails closed',()=>{
  const r=qualifyRomaniaComparableQuery({platform:'TRENDYOL',query:'set organizatoare valiza',declaredCount:12,countScope:'QUERY_SCOPED',sampleResults:clean.slice(0,5)});
  assert.equal(r.qualifiedForComparableCountCandidate,false);
  assert.ok(r.blockers.includes('SAMPLE_TOO_SMALL'));
});

test('qualification report remains zero-cost and non-purchasing',()=>{
  const r=buildRomaniaQueryQualificationReport({candidates:[{platform:'EMAG',query:'x',declaredCount:1,countScope:'QUERY_SCOPED',sampleResults:clean}]});
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.approvedSpendEur,0);
  assert.equal(r.purchaseAuthorized,false);
  assert.match(r.policy,/NO_VERIFIED_SALES/);
  assert.match(r.policy,/UNKNOWN_IS_NOT_ZERO/);
});
