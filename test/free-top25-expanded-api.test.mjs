import assert from 'node:assert/strict';
import test from 'node:test';
import {buildLiveOnlyTop25Catalogue,createFreeTop25Handler} from '../netlify/functions/free-top25.mjs';
test('taxonomy remains available without republishing historical product rows',async()=>{
  const catalogue=buildLiveOnlyTop25Catalogue();
  assert.equal(catalogue.niches.length,25);
  assert.equal(catalogue.stats.targetPositions,625);
  assert.equal(catalogue.stats.publishedProductCount,0);
  assert.ok(catalogue.niches.every(n=>n.products.length===0));
  let reads=0;
  const handler=createFreeTop25Handler({env:{},fetch:async()=>{reads++;throw new Error('Historical read forbidden');}});
  const response=await handler(new Request('https://example.test/api/free/top25'));
  assert.equal(response.status,200);
  assert.equal(reads,0);
  assert.equal((await response.json()).policy.historicalFallback,false);
});
