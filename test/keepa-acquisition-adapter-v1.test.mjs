import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildKeepaBestSellerPlan,buildKeepaProductHydrationPlan,keepaRequestSpec,authorizeKeepaPlan,normalizeKeepaIdentity} from '../keepa-acquisition-adapter.js';

test('best seller seed planner estimates tokens without authorizing execution',()=>{
  const plan=buildKeepaBestSellerPlan({domain:3,categoryIds:['1','2','2','3']});
  assert.equal(plan.taskCount,3);
  assert.equal(plan.estimatedTokens,150);
  assert.equal(plan.paidExecutionAuthorized,false);
  assert.ok(plan.tasks.every(x=>x.executeAutomatically===false));
});

test('ASIN hydration deduplicates ids and uses one token per product identity',()=>{
  const plan=buildKeepaProductHydrationPlan({asins:['A','B','A','C'],batchSize:2});
  assert.equal(plan.asinCount,3);
  assert.equal(plan.batchCount,2);
  assert.equal(plan.estimatedTokens,3);
});

test('request specs require a server-side Keepa secret but never contain the key',()=>{
  const spec=keepaRequestSpec({type:'BEST_SELLERS',domain:3,categoryId:'123'});
  assert.equal(spec.valid,true);
  assert.equal(spec.requiresSecret,'KEEPA_API_KEY');
  assert.equal('key' in spec.params,false);
  assert.equal(spec.baseUrl,'https://api.keepa.com');
});

test('Keepa paid plan is blocked without explicit price and approval',()=>{
  const plan=buildKeepaBestSellerPlan({categoryIds:['1']});
  assert.equal(authorizeKeepaPlan(plan,{explicitApproval:false,budgetRemainingEur:100}).authorized,false);
  assert.equal(authorizeKeepaPlan(plan,{explicitApproval:true,budgetRemainingEur:100}).reason,'PRICE_CONFIGURATION_REQUIRED');
  const approved=authorizeKeepaPlan(plan,{explicitApproval:true,budgetRemainingEur:100,monthlyPriceEur:20});
  assert.equal(approved.authorized,true);
  assert.equal(approved.executeAutomatically,false);
});

test('Keepa identity normalization never calls provider sales verified',()=>{
  const row=normalizeKeepaIdentity({asin:'B0123',title:'Example',brand:'Brand'});
  assert.equal(row.externalId,'B0123');
  assert.equal(row.evidenceClass,'LICENSED_PROVIDER');
  assert.equal(row.rawSalesVerified,false);
  assert.equal(row.purchaseAuthorized,false);
  assert.equal(normalizeKeepaIdentity({title:'No ASIN'}),null);
});

test('adapter contains no fetch call or embedded API key',async()=>{
  const source=await fs.readFile(new URL('../keepa-acquisition-adapter.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/key=[A-Za-z0-9]/);
  assert.match(source,/KEEPA_API_KEY/);
});
