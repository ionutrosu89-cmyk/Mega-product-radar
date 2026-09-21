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

test('scheduled refresh marks snapshots older than 72 hours stale before collection',async()=>{
  const calls=[];
  const env={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service'};
  const handler=createTop25LiveRefreshHandler({env,now:()=>new Date('2026-09-20T05:30:00Z'),fetchImpl:async(url,options={})=>{calls.push({url:String(url),options});return new Response(null,{status:204});},logger:{info(){}}});
  const response=await handler();
  assert.equal(response.status,204);
  assert.equal(calls.length,1);
  const request=new URL(calls[0].url);
  assert.equal(request.pathname,'/rest/v1/current_top25_snapshots_v1');
  assert.equal(request.searchParams.get('freshness_status'),'eq.CURRENT');
  assert.equal(request.searchParams.get('window_end'),'lt.2026-09-17T05:30:00.000Z');
  assert.equal(calls[0].options.method,'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body),{freshness_status:'STALE'});
});
