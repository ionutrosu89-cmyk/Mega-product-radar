import assert from 'node:assert/strict';
import test from 'node:test';
import {build10kAcquisitionPlan,evaluateAcquisitionBatch,build10kProgressDashboard} from '../global-product-universe-10k-pipeline.js';

test('10k plan is free-first and never auto executes',()=>{
  const plan=build10kAcquisitionPlan({currentUniqueProducts:1200});
  assert.equal(plan.target,10000);
  assert.equal(plan.remaining,8800);
  assert.equal(plan.approvedSpendEur,0);
  assert.equal(plan.paidProviderExecutionAllowed,false);
  assert.equal(plan.externalExecutionTriggered,false);
  assert.equal(plan.executeAutomatically,false);
  assert.equal(plan.purchaseAuthorized,false);
});

test('credentialed demand/catalogue sources are separated from supply discovery',()=>{
  const plan=build10kAcquisitionPlan({currentUniqueProducts:0,credentials:{EBAY_BEST_SELLING:true}});
  assert.ok(plan.readySources.includes('AMAZON_PUBLIC_RANKINGS'));
  assert.ok(plan.readySources.includes('EBAY_BEST_SELLING'));
  assert.ok(!plan.readySources.includes('ALIBABA_TOP_RANKING'));
  assert.deepEqual(plan.supplyDiscoverySources,['ALIBABA_TOP_RANKING']);
  assert.equal(plan.supplyDiscoveryCountsTowardDemandTarget,false);
  assert.ok(plan.blockedSources.some(x=>x.sourceKey==='ETSY_OPEN_API'&&x.reason==='CREDENTIALS_REQUIRED'));
  assert.ok(plan.blockedSources.some(x=>x.sourceKey==='WALMART_CATALOG_SEARCH'&&x.reason==='CREDENTIALS_REQUIRED'));
});

test('allocation preserves 70 percent true ranking seed and 30 percent catalogue breadth intent',()=>{
  const plan=build10kAcquisitionPlan({currentUniqueProducts:0});
  const ranking=plan.allocation.filter(x=>x.role==='RANKING_SEED').reduce((a,b)=>a+b.targetNewUniqueProducts,0);
  const catalogue=plan.allocation.filter(x=>x.role==='CATALOGUE_DISCOVERY').reduce((a,b)=>a+b.targetNewUniqueProducts,0);
  assert.equal(ranking,7000);
  assert.equal(catalogue,3000);
  assert.equal(plan.acquisitionMix.rankingSeedPct,70);
  assert.equal(plan.supplyDiscoveryCountsTowardDemandTarget,false);
});

test('batch evaluation reports observed unique yield without claiming sales',()=>{
  const out=evaluateAcquisitionBatch({beforeUniqueProducts:1000,plannedNewUniqueProducts:500,sourceKey:'AMAZON_PUBLIC_RANKINGS',afterSeedResult:{uniqueProductObservationCount:1380,duplicateObservationCount:90,rejectedCount:30,crossPlatformReview:[{},{}]}});
  assert.equal(out.addedUniqueProducts,380);
  assert.equal(out.yieldPct,76);
  assert.equal(out.crossPlatformReviewCount,2);
  assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.purchaseAuthorized,false);
});

test('progress dashboard uses conservative milestone states',()=>{
  const a=build10kProgressDashboard({seedResult:{uniqueProductObservationCount:700}});
  const b=build10kProgressDashboard({seedResult:{uniqueProductObservationCount:2500}});
  const c=build10kProgressDashboard({seedResult:{uniqueProductObservationCount:7000}});
  const d=build10kProgressDashboard({seedResult:{uniqueProductObservationCount:10000}});
  assert.equal(a.status,'SCALE_TO_1K');
  assert.equal(b.status,'SCALE_TO_5K');
  assert.equal(c.status,'SCALE_TO_10K');
  assert.equal(d.status,'TARGET_REACHED');
  assert.equal(d.progressPct,100);
  assert.equal(d.paidCallsTriggered,0);
});
