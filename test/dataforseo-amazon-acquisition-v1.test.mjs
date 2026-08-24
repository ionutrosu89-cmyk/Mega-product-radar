import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildAmazonProductTasks,splitAmazonTaskPosts,estimateAmazonAcquisitionCost,authorizeAmazonAcquisition,dataforseoAmazonRequestSpec,acquisitionYieldEstimate} from '../dataforseo-amazon-acquisition-adapter.js';

test('Amazon task planner bills one SERP per up-to-100 requested results',()=>{
  const p100=buildAmazonProductTasks({queries:['desk organizer'],depth:100});
  assert.equal(p100.billableSerps,1);
  assert.equal(p100.maxResultsRequested,100);
  const p700=buildAmazonProductTasks({queries:['desk organizer'],depth:700});
  assert.equal(p700.billableSerps,7);
  assert.equal(p700.maxResultsRequested,700);
});

test('planner deduplicates queries and splits POST batches at provider limit',()=>{
  const queries=Array.from({length:205},(_,i)=>`q${i}`).concat('q1');
  const plan=buildAmazonProductTasks({queries,depth:100});
  assert.equal(plan.taskCount,205);
  const batches=splitAmazonTaskPosts(plan.tasks);
  assert.deepEqual(batches.map(x=>x.length),[100,100,5]);
});

test('cost estimate uses explicit billable SERPs and FX',()=>{
  const plan=buildAmazonProductTasks({queries:['a','b'],depth:700});
  assert.equal(plan.billableSerps,14);
  const noFx=estimateAmazonAcquisitionCost(plan);
  assert.equal(noFx.status,'FX_REQUIRED');
  assert.equal(noFx.costUsd,0.021);
  const cost=estimateAmazonAcquisitionCost(plan,{fxUsdEur:.9});
  assert.equal(cost.costUsd,0.021);
  assert.equal(cost.costEur,0.0189);
});

test('paid acquisition remains blocked until explicit approval',()=>{
  const plan=buildAmazonProductTasks({queries:['a'],depth:100});
  assert.equal(authorizeAmazonAcquisition(plan,{budgetRemainingEur:100,fxUsdEur:.9}).authorized,false);
  const approved=authorizeAmazonAcquisition(plan,{explicitApproval:true,budgetRemainingEur:100,fxUsdEur:.9});
  assert.equal(approved.authorized,true);
  assert.equal(approved.executeAutomatically,false);
});

test('request spec contains no credentials and max 100 tasks',()=>{
  const plan=buildAmazonProductTasks({queries:['a','b'],depth:100});
  const spec=dataforseoAmazonRequestSpec(plan.tasks);
  assert.equal(spec.valid,true);
  assert.deepEqual(spec.requiresSecrets,['DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD']);
  assert.equal(spec.executeAutomatically,false);
  assert.equal(spec.body.length,2);
  assert.equal(dataforseoAmazonRequestSpec(Array.from({length:101},()=>({keyword:'x'}))).valid,false);
});

test('unique product yield stays explicitly estimated until observed',()=>{
  const plan=buildAmazonProductTasks({queries:['a','b'],depth:700});
  const yieldEstimate=acquisitionYieldEstimate(plan,{dedupeRatePct:25});
  assert.equal(yieldEstimate.requestedRows,1400);
  assert.equal(yieldEstimate.estimatedUniqueUpperBound,1050);
  assert.equal(yieldEstimate.evidenceClass,'PLANNING_ESTIMATE');
  assert.equal(yieldEstimate.verifiedUniqueProducts,null);
});

test('adapter has no network call or embedded credential',async()=>{
  const source=await fs.readFile(new URL('../dataforseo-amazon-acquisition-adapter.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/Basic\s+[A-Za-z0-9+/=]{8,}/);
});
