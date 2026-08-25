import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFirstFinalistProgram,FIRST_FINALIST_KPIS} from '../first-finalist-program-v1.js';
import current from '../data/first-finalist-program-current-v1.json' with {type:'json'};

test('program exposes exactly the eight evidence KPIs',()=>{
  assert.deepEqual(FIRST_FINALIST_KPIS,[
    'productsWithTwoLiveSnapshots','productsWithConfirmedTrendFusion','nichesWithExactRomaniaGap','productsWithVerifiedSupplierPackage','productsWithConfirmedLandedEconomics','promisingProducts','validateProducts','finalistProducts'
  ]);
});

test('current real baseline stays blocked at longitudinal data',()=>{
  const out=buildFirstFinalistProgram(current);
  assert.equal(out.phase,'DATA_LONGITUDINAL');
  assert.equal(out.nextAction,'EXECUTE_AMAZON_ROUND2_AFTER_ELIGIBILITY');
  assert.equal(out.metrics.firstLiveCoveragePct,25.5);
  assert.equal(out.metrics.finalistProducts,0);
  assert.equal(out.scaleGate.scaleNow,false);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.spend.paidCallsTriggered,0);
});

test('evidence progression is ordered and does not skip Romania supplier or economics',()=>{
  const base={productUniverse:1000,productsWithFirstLiveSnapshot:255,productsWithTwoLiveSnapshots:200};
  assert.equal(buildFirstFinalistProgram(base).phase,'TREND_FUSION');
  assert.equal(buildFirstFinalistProgram({...base,productsWithConfirmedTrendFusion:4}).phase,'ROMANIA_EXACT');
  assert.equal(buildFirstFinalistProgram({...base,productsWithConfirmedTrendFusion:4,nichesWithExactRomaniaGap:1}).phase,'SUPPLIER_VERIFICATION');
  assert.equal(buildFirstFinalistProgram({...base,productsWithConfirmedTrendFusion:4,nichesWithExactRomaniaGap:1,productsWithVerifiedSupplierPackage:1}).phase,'CONFIRMED_ECONOMICS');
});

test('first finalist unlocks staged breadth scale but never purchase authority',()=>{
  const out=buildFirstFinalistProgram({
    productUniverse:1000,productsWithFirstLiveSnapshot:900,productsWithTwoLiveSnapshots:700,productsWithConfirmedTrendFusion:20,nichesWithExactRomaniaGap:5,productsWithVerifiedSupplierPackage:2,productsWithConfirmedLandedEconomics:1,promisingProducts:12,validateProducts:3,finalistProducts:1
  });
  assert.equal(out.phase,'FIRST_FINALIST');
  assert.equal(out.scaleGate.scaleNow,true);
  assert.equal(out.scaleGate.nextTarget,10000);
  assert.equal(out.purchaseAuthorized,false);
});

test('unknown inputs never become fabricated evidence progress',()=>{
  const out=buildFirstFinalistProgram({productUniverse:1000,productsWithFirstLiveSnapshot:255,productsWithTwoLiveSnapshots:null,nichesWithExactRomaniaGap:''});
  assert.equal(out.metrics.productsWithTwoLiveSnapshots,0);
  assert.equal(out.metrics.nichesWithExactRomaniaGap,0);
  assert.equal(out.gates.DATA_LONGITUDINAL,false);
  assert.equal(out.gates.ROMANIA_EXACT,false);
});
