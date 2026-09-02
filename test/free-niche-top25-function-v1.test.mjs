import assert from 'node:assert/strict';
import test from 'node:test';
import {createFreeNicheTop25Handler} from '../netlify/functions/free-niche-top25.mjs';

test('Free niche endpoint always serves the bundled 108-niche taxonomy',async()=>{
  const handler=createFreeNicheTop25Handler({env:{},fetch:async()=>new Response(null,{status:503})});
  const response=await handler(new Request('https://mpr.example/api/free/niches'));
  const body=await response.json();

  assert.equal(response.status,200);
  assert.equal(body.ok,true);
  assert.equal(body.schema,'MPR_FREE_NICHE_TOP25_PLAN_V1');
  assert.equal(body.stats.totalNiches,108);
  assert.equal(body.stats.targetProductSlots,2700);
  assert.equal(body.truthPolicy.incompleteNicheProductsHidden,true);
});
