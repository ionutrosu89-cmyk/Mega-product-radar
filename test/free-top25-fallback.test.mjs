import test from 'node:test';
import assert from 'node:assert/strict';
import {createFreeTop25Handler} from '../netlify/functions/free-top25.mjs';

function historicalNiches(){
  return Array.from({length:25},(_,n)=>({
    id:`niche-${n+1}`,
    label:`Nișă ${n+1}`,
    reviewedAt:'2026-09-04T09:40:41.174Z',
    mode:'LICENSED_HISTORICAL_EVIDENCE',
    eligibleProductCount:25,
    products:Array.from({length:25},(_,p)=>({name:`Produs ${n+1}-${p+1}`,rank:p+1,sourceKey:'KAGGLE_AMAZON_PRODUCTS_2023'}))
  }));
}

test('Free Top25 stays available from complete licensed historical 25x25 when live sources are unavailable',async()=>{
  const handler=createFreeTop25Handler({
    env:{},
    rateLimitImpl:async()=>({ok:true,remaining:89}),
    loadSourceImpl:async()=>({data:null,via:'UNAVAILABLE'}),
    loadExpandedImpl:async()=>historicalNiches()
  });
  const response=await handler(new Request('https://example.test/api/free/top25'));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.mode,'LICENSED_HISTORICAL_ONLY');
  assert.equal(body.stats.publishedNicheCount,25);
  assert.equal(body.stats.publishedProductCount,625);
  assert.equal(body.sourceDiagnostics.historical,'COMPLETE');
});

test('Free Top25 fails closed when live sources are unavailable and licensed historical archive is incomplete',async()=>{
  const handler=createFreeTop25Handler({
    env:{},
    rateLimitImpl:async()=>({ok:true,remaining:89}),
    loadSourceImpl:async()=>({data:null,via:'UNAVAILABLE'}),
    loadExpandedImpl:async()=>historicalNiches().slice(0,24)
  });
  const response=await handler(new Request('https://example.test/api/free/top25'));
  assert.equal(response.status,503);
  const body=await response.json();
  assert.equal(body.ok,false);
});
