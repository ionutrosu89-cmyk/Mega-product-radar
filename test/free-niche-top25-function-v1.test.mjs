import assert from 'node:assert/strict';
import test from 'node:test';
import {createFreeNicheTop25Handler} from '../netlify/functions/free-niche-top25.mjs';

test('Free live niche endpoint fails closed until redistribution rights are explicitly approved',async()=>{
  const handler=createFreeNicheTop25Handler({env:{},fetch:async()=>new Response(null,{status:503})});
  const response=await handler(new Request('https://mpr.example/api/free/niches'));
  const body=await response.json();

  assert.equal(response.status,503);
  assert.equal(body.ok,false);
  assert.equal(body.code,'FREE_LIVE_NICHES_RIGHTS_HOLD');
  assert.equal(body.publicAlternative,'/api/free/top25');
});

test('approved live niche route exposes the bundled 108-niche taxonomy without weakening truth gates',async()=>{
  const handler=createFreeNicheTop25Handler({env:{MPR_FREE_LIVE_NICHES_APPROVED:'true'},fetch:async()=>new Response(null,{status:503})});
  const response=await handler(new Request('https://mpr.example/api/free/niches'));
  const body=await response.json();

  assert.equal(response.status,200);
  assert.equal(body.ok,true);
  assert.equal(body.schema,'MPR_FREE_NICHE_TOP25_PLAN_V1');
  assert.equal(body.stats.totalNiches,108);
  assert.equal(body.stats.targetProductSlots,2700);
  assert.equal(body.truthPolicy.incompleteNicheProductsHidden,true);
  assert.equal(body.truthPolicy.verifiedSalesClaimed,false);
  assert.equal(body.truthPolicy.purchaseAuthorized,false);
});
