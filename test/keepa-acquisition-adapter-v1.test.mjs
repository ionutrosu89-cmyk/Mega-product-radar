import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildKeepaBestSellerPlan,buildKeepaProductHydrationPlan,keepaRequestSpec,authorizeKeepaPlan,normalizeKeepaIdentity,normalizeKeepaBestSellerList,keepaTimeToIso} from '../keepa-acquisition-adapter.js';

test('best seller seed planner estimates tokens without authorizing execution',()=>{
  const plan=buildKeepaBestSellerPlan({domain:3,categoryIds:['1','2','2','3']});
  assert.equal(plan.taskCount,3);
  assert.equal(plan.estimatedTokens,150);
  assert.equal(plan.paidExecutionAuthorized,false);
  assert.ok(plan.tasks.every(x=>x.executeAutomatically===false));
});

test('the pilot defaults to Amazon.com US and refuses an unsupported domain',()=>{
  const us=buildKeepaBestSellerPlan({categoryIds:['123']});
  assert.equal(us.tasks[0].domain,1);
  assert.equal(keepaRequestSpec(us.tasks[0]).params.domain,1);
  assert.equal(buildKeepaProductHydrationPlan({asins:['B0123']}).batches[0].domain,1);
  const invalid=buildKeepaBestSellerPlan({domain:12,categoryIds:['123']});
  assert.equal(invalid.valid,false);
  assert.equal(invalid.taskCount,0);
  assert.equal(authorizeKeepaPlan(invalid,{explicitApproval:true,budgetRemainingEur:100,monthlyPriceEur:20}).authorized,false);
  assert.equal(keepaRequestSpec({type:'BEST_SELLERS',domain:12,categoryId:'123'}).reason,'UNSUPPORTED_DOMAIN');
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
  assert.equal(row.observedAt,null);
  assert.equal(normalizeKeepaIdentity({title:'No ASIN'}),null);
});

test('Best Sellers candidates preserve the provider update time and reject stale or mismatched lists',()=>{
  const now=new Date('2026-09-25T10:00:00Z');
  const sourceTime=Math.floor(Date.parse('2026-09-25T09:15:00Z')/60_000-21_564_000);
  const payload={bestSellersList:{domainId:1,categoryId:123,lastUpdate:sourceTime,asinList:Array.from({length:30},(_,i)=>`B${String(i+1).padStart(9,'0')}`)}};
  const accepted=normalizeKeepaBestSellerList(payload,{categoryId:'123',now});
  assert.equal(accepted.ok,true);
  assert.equal(accepted.candidates.length,30);
  assert.equal(accepted.candidates[0].sourceRank,1);
  assert.equal(accepted.candidates[0].market,'AMAZON_US');
  assert.equal(accepted.sourceUpdatedAt,'2026-09-25T09:15:00.000Z');
  assert.equal(keepaTimeToIso(null),null);
  assert.equal(normalizeKeepaBestSellerList(payload,{domain:3,categoryId:'123',now}).code,'MARKET_OR_CATEGORY_MISMATCH');
  assert.equal(normalizeKeepaBestSellerList(payload,{categoryId:'456',now}).code,'MARKET_OR_CATEGORY_MISMATCH');
  assert.equal(normalizeKeepaBestSellerList({...payload,bestSellersList:{...payload.bestSellersList,lastUpdate:sourceTime-73*60}},{categoryId:'123',now}).code,'STALE_OR_UNKNOWN_SOURCE_UPDATE');
  assert.equal(normalizeKeepaBestSellerList({...payload,bestSellersList:{...payload.bestSellersList,lastUpdate:null}},{categoryId:'123',now}).code,'STALE_OR_UNKNOWN_SOURCE_UPDATE');
});

test('adapter contains no fetch call or embedded API key',async()=>{
  const source=await fs.readFile(new URL('../keepa-acquisition-adapter.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/key=[A-Za-z0-9]/);
  assert.match(source,/KEEPA_API_KEY/);
});
