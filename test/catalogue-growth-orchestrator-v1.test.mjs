import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOGUE_MILESTONES,catalogueProgress,buildCatalogueCoveragePlan,authorizeCatalogueSource,catalogueGrowthDashboard} from '../catalogue-growth-orchestrator.js';

test('catalogue milestones are 10k 50k 100k',()=>{
  assert.deepEqual(CATALOGUE_MILESTONES.map(x=>x.targetProducts),[10000,50000,100000]);
  assert.equal(catalogueProgress(65).nextMilestone.targetProducts,10000);
  assert.equal(catalogueProgress(12000).nextMilestone.targetProducts,50000);
  assert.equal(catalogueProgress(60000).nextMilestone.targetProducts,100000);
});

test('coverage grows breadth first and prioritizes niches below useful minimum',()=>{
  const plan=buildCatalogueCoveragePlan({niches:['desk-organization','phone-holders','car-storage'],currentCounts:{'desk-organization':10,'phone-holders':30,'car-storage':0},targetProducts:300,minUsefulPerNiche:25,maxBatchPerNiche:100});
  assert.equal(plan.policy,'BREADTH_FIRST_BEFORE_DEEP_ENRICHMENT');
  assert.equal(plan.tasks[0].priority,'CRITICAL');
  assert.ok(plan.criticalNiches>=2);
  assert.ok(plan.tasks.every(x=>x.nextBatch<=100));
});

test('zero cost sources may be planned but never auto executed',()=>{
  const a=authorizeCatalogueSource('AMAZON_PUBLIC');
  assert.equal(a.authorized,true);
  assert.equal(a.executeAutomatically,false);
});

test('paid sources remain blocked without explicit approval and cost envelope',()=>{
  assert.equal(authorizeCatalogueSource('KEEPA_LICENSED').authorized,false);
  assert.equal(authorizeCatalogueSource('KEEPA_LICENSED',{explicitPaidApproval:true,monthlyBudgetRemainingEur:50,estimatedCostEur:0}).authorized,false);
  assert.equal(authorizeCatalogueSource('KEEPA_LICENSED',{explicitPaidApproval:true,monthlyBudgetRemainingEur:5,estimatedCostEur:10}).authorized,false);
  const ok=authorizeCatalogueSource('KEEPA_LICENSED',{explicitPaidApproval:true,monthlyBudgetRemainingEur:50,estimatedCostEur:10});
  assert.equal(ok.authorized,true);
  assert.equal(ok.executeAutomatically,false);
});

test('growth dashboard itself cannot trigger paid calls or purchasing',()=>{
  const d=catalogueGrowthDashboard({currentProducts:65,niches:['a','b'],currentCounts:{a:20,b:45}});
  assert.equal(d.paidCallsTriggered,0);
  assert.equal(d.purchaseAuthorized,false);
  assert.equal(d.progress.architectureTarget,100000);
});
