import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {createTop25LiveRefreshHandler} from '../netlify/functions/top25-live-refresh.mjs';

test('scheduled live refresh makes zero provider calls before credentials and display rights are ready',async()=>{
  let providerCalls=0,logged=null;
  const handler=createTop25LiveRefreshHandler({env:{},now:()=>new Date('2026-09-20T05:30:00Z'),fetchImpl:async()=>{providerCalls++;return new Response(null,{status:500});},logger:{info:(_message,payload)=>{logged=payload;}}});
  const response=await handler();
  assert.equal(response.status,204);
  assert.equal(providerCalls,0);
  assert.equal(logged.providers[0].access,'ACCESS_REQUIRED');
  assert.equal(logged.purchaseAuthorized,false);
});

test('scheduled live refresh cadence is daily and contains no paid provider',async()=>{
  const source=await fs.readFile(new URL('../netlify/functions/top25-live-refresh.mjs',import.meta.url),'utf8');
  assert.match(source,/schedule:'30 5 \* \* \*'/);
  assert.doesNotMatch(source,/KEEPA|DATAFORSEO|OPENAI_API_KEY/i);
});
