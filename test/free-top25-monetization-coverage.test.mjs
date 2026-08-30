import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFreeTop25LiveUniverse} from '../free-top25-live-v1.js';

function product(i,category='Home'){
  return {name:`Produs ${i}`,cat:category,discoveryAnalysis:{score:100-i},signals:{amazonUS:{present:true,evidenceClass:'VERIFIED',label:'Amazon US',links:[{url:`https://www.amazon.com/dp/T${i}`}]}}};
}

test('coverage exposes exact deficit without promoting incomplete niches',()=>{
  const report=buildFreeTop25LiveUniverse({discoveryProducts:Array.from({length:20},(_,i)=>product(i+1))});
  assert.equal(report.stats.completeNicheCount,0);
  assert.equal(report.coverage.length,1);
  assert.equal(report.coverage[0].eligibleProductCount,20);
  assert.equal(report.coverage[0].deficitToTop25,5);
  assert.equal(report.coverage[0].status,'NEAR_READY');
  assert.equal(report.niches.length,0);
});

test('coverage marks a niche ready only at 25 accepted products',()=>{
  const report=buildFreeTop25LiveUniverse({discoveryProducts:Array.from({length:25},(_,i)=>product(i+1))});
  assert.equal(report.coverage[0].status,'TOP25_READY');
  assert.equal(report.coverage[0].deficitToTop25,0);
  assert.equal(report.stats.completeNicheCount,1);
  assert.equal(report.niches[0].products.length,25);
});

test('coverage total deficit sums observed commercial-evidence niches only',()=>{
  const rows=[...Array.from({length:22},(_,i)=>product(i+1,'Home')),...Array.from({length:10},(_,i)=>product(i+101,'Pet'))];
  const report=buildFreeTop25LiveUniverse({discoveryProducts:rows});
  assert.equal(report.stats.observedNicheCount,2);
  assert.equal(report.stats.totalDeficitToCompleteAllObservedNiches,18);
  assert.equal(report.truthPolicy.commercialEligibilityMeasuredOnlyFromAcceptedLiveEvidence,true);
});
