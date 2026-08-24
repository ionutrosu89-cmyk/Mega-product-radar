import assert from 'node:assert/strict';
import test from 'node:test';
import {buildKeepaCategoryResolutionPlan,resolveKeepaCategoryMatches,buildTenKSeedPlan,seedPilotReadiness} from '../keepa-10k-seed-pilot.js';

const universe={version:'2.0',departments:[{key:'home',label:'Home',children:[
  {key:'kitchen',label:'Kitchen',niches:['storage','prep']},
  {key:'bath',label:'Bath',niches:['storage']},
  {key:'office',label:'Office',niches:['desk']},
  {key:'auto',label:'Auto',niches:['interior']},
  {key:'pet',label:'Pet',niches:['travel']}
]}]};

test('taxonomy becomes category-search tasks without network execution',()=>{
  const plan=buildKeepaCategoryResolutionPlan(universe,{maxNodes:5});
  assert.equal(plan.taskCount,5);
  assert.equal(plan.estimatedTokens,5);
  assert.ok(plan.tasks.every(x=>x.type==='CATEGORY_SEARCH'&&x.executeAutomatically===false));
});

test('category mapping requires both confidence and manual review',()=>{
  const plan=buildKeepaCategoryResolutionPlan(universe,{maxNodes:5});
  const matches=plan.tasks.map((t,i)=>({mprKey:t.mprKey,categoryId:String(100+i),confidence:i===0?95:80,manuallyReviewed:i!==1}));
  const resolved=resolveKeepaCategoryMatches(plan,matches);
  assert.equal(resolved[0].accepted,true);
  assert.equal(resolved[1].accepted,false);
  assert.equal(resolved[1].categoryId,null);
});

test('10k seed plan caps acquisition at target and estimates token burden',()=>{
  const resolved=['1','2','3','4','5'].map((categoryId,i)=>({mprKey:`c${i}`,categoryId,confidence:90,manuallyReviewed:true,accepted:true}));
  const plan=buildTenKSeedPlan({resolvedCategories:resolved,targetProducts:10000});
  assert.equal(plan.categoryCount,5);
  assert.equal(plan.allocationPerCategory,2000);
  assert.equal(plan.bestSellerPlan.estimatedTokens,250);
  assert.equal(plan.estimatedHydrationTokens,10000);
  assert.equal(plan.totalEstimatedTokensAfterCategoryResolution,10250);
  assert.equal(plan.paidExecutionAuthorized,false);
  assert.equal(plan.purchaseAuthorized,false);
});

test('pilot stays blocked until at least five category matches are manually accepted',()=>{
  const resolutionPlan=buildKeepaCategoryResolutionPlan(universe,{maxNodes:5});
  const four=['1','2','3','4'].map((categoryId,i)=>({mprKey:`c${i}`,categoryId,accepted:true}));
  assert.equal(seedPilotReadiness({resolutionPlan,resolvedCategories:four,seedPlan:{targetProducts:10000,categoryCount:4}}).ready,false);
  const five=[...four,{mprKey:'c4',categoryId:'5',accepted:true}];
  const ready=seedPilotReadiness({resolutionPlan,resolvedCategories:five,seedPlan:{targetProducts:10000,categoryCount:5}});
  assert.equal(ready.ready,true);
  assert.equal(ready.blocker,null);
  assert.equal(ready.paidExecutionAuthorized,false);
});
