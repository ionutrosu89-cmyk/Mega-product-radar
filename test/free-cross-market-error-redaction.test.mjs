import assert from 'node:assert/strict';
import test from 'node:test';
import {createFreeCrossMarketHandler} from '../netlify/functions/free-cross-market.mjs';

test('free cross-market API redacts internal exception details and returns an incident id',async()=>{
  const logs=[];
  const handler=createFreeCrossMarketHandler({
    env:{},
    fetch:async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}}),
    now:()=>{throw new Error('SECRET_INTERNAL_DETAIL_123');},
    logger:{error:(...args)=>logs.push(args)}
  });
  const response=await handler(new Request('https://example.test/api/free/cross-market',{
    headers:{'x-request-id':'incident-test-1','x-forwarded-for':'203.0.113.7'}
  }));
  const body=await response.json();
  assert.equal(response.status,500);
  assert.equal(body.ok,false);
  assert.equal(body.error,'Internal server error');
  assert.equal(body.incidentId,'incident-test-1');
  assert.equal(JSON.stringify(body).includes('SECRET_INTERNAL_DETAIL_123'),false);
  assert.equal(logs.length,1);
  assert.equal(JSON.stringify(logs[0]).includes('SECRET_INTERNAL_DETAIL_123'),true);
});
