import assert from 'node:assert/strict';
import test from 'node:test';
import {buildYouTubeQueryPlan,collectYouTubeSignals} from '../youtube-viral-collector.js';

const plan=buildYouTubeQueryPlan([{conceptName:'paw cleaner',category:'Pet',brandPolicyClass:'GENERIC_PRIVATE_LABEL'}],{markets:['US','GB'],maxQueries:20,publishedAfter:'2026-08-01T00:00:00Z'});
test('query plan is market-specific and capped',()=>{assert.equal(plan.length,2);assert.deepEqual(plan.map(x=>x.market),['US','GB']);});
test('collector fails closed without approval and key',async()=>{const out=await collectYouTubeSignals(plan,{});assert.equal(out.status,'HELD');assert.equal(out.apiCalls,0);assert.equal(out.reason,'YOUTUBE_TERMS_APPROVAL_REQUIRED');});
test('approved collector normalizes direct evidence without sales claims',async()=>{
  let n=0;const fetchImpl=async url=>{n++;const isSearch=String(url).includes('/search?');return {ok:true,json:async()=>isSearch?{items:[{id:{videoId:'abc'}}]}:{items:[{id:'abc',snippet:{title:'Paw cleaner demo'},statistics:{viewCount:'1200',likeCount:'80',commentCount:'20'}}]}};};
  const out=await collectYouTubeSignals(plan.slice(0,1),{apiKey:'test',termsApproved:true,sourceEnabled:true,fetchImpl,observedAt:'2026-09-01T00:00:00Z'});
  assert.equal(n,2);assert.equal(out.status,'COMPLETED');assert.equal(out.observations[0].metrics.viewCount,1200);assert.equal(out.policy.claimsSales,false);assert.equal(out.observations[0].purchaseAuthorized,false);
});
