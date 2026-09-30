import assert from 'node:assert/strict';
import test from 'node:test';
import {dueCurrentTop25Targets} from '../netlify/functions/_top25-current-store.mjs';
import {createEbayCrossMarketRefreshHandler} from '../netlify/functions/ebay-cross-market-refresh.mjs';
import {createAliExpressCrossMarketRefreshHandler} from '../netlify/functions/aliexpress-cross-market-refresh.mjs';
import {EBAY_BUY_AUTH,resetEbayTokenCacheForTests} from '../netlify/functions/_ebay-buy-auth.mjs';

const now=new Date('2026-09-30T06:00:00Z');
const products=(observedAt='2026-09-29T06:00:00Z')=>Array.from({length:25},(_,index)=>({name:`Product ${index+1}`,externalId:`item-${index+1}`,rank:index+1,observedAt}));
const row=(nicheId='AUTO',market='EBAY_US',observedAt='2026-09-29T06:00:00Z')=>({niche_id:nicheId,market,window_end:observedAt,products:products(observedAt)});
const baseEnv={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service',MPR_INTERNAL_REFRESH_SECRET:'internal'};
const scheduledRequest=()=>new Request('https://mpr.example/api/internal/refresh',{method:'POST',headers:{'x-mpr-internal-secret':'internal','content-type':'application/json'},body:JSON.stringify({mode:'PUBLISH_DUE'})});

test('cadence selects only targets without 25 valid observations in the past 14 days',async()=>{
  const targets=[{nicheId:'AUTO',marketplaceId:'EBAY_US'},{nicheId:'CASA',marketplaceId:'EBAY_US'}];
  const calls=[];
  const result=await dueCurrentTop25Targets({env:baseEnv,platform:'EBAY',targets,now,fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return Response.json([row()]);}});
  assert.equal(result.ok,true);
  assert.equal(result.refreshTargetDays,14);
  assert.deepEqual(result.dueTargets,[targets[1]]);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/window_end=gte\./);
  assert.equal(calls[0].options.headers.authorization,'Bearer service');

  const mixed=row();mixed.products[0].observedAt='2026-09-15T06:00:00Z';
  const oldProduct=await dueCurrentTop25Targets({env:baseEnv,platform:'EBAY',targets:[targets[0]],now,fetchImpl:async()=>Response.json([mixed])});
  assert.deepEqual(oldProduct.dueTargets,[targets[0]]);
});

test('scheduled eBay refresh skips provider when its approved Top25 is already recent',async()=>{
  const env={...baseEnv,EBAY_CLIENT_ID:'client',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true',MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'true',MPR_EBAY_CROSS_MARKET_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'}])};
  const calls=[];
  const handler=createEbayCrossMarketRefreshHandler({env,now:()=>now,fetchImpl:async(url)=>{calls.push(String(url));if(String(url).startsWith('https://db.example/'))return Response.json([row()]);throw new Error('Provider must not be called');}});
  const response=await handler(scheduledRequest());
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,'NOT_DUE');
  assert.equal(calls.length,1);
});

test('scheduled eBay refresh collects only the niche whose snapshot is due',async()=>{
  resetEbayTokenCacheForTests();
  const env={...baseEnv,EBAY_CLIENT_ID:'client',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true',MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'true',MPR_EBAY_CROSS_MARKET_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'},{nicheId:'CASA',categoryId:'7000',marketplaceId:'EBAY_US'}])};
  const calls=[];
  const handler=createEbayCrossMarketRefreshHandler({env,now:()=>now,fetchImpl:async(url,options={})=>{
    calls.push({url:String(url),method:options.method||'GET'});
    if(String(url).startsWith('https://db.example/')&&options.method==='POST')return new Response(null,{status:201});
    if(String(url).startsWith('https://db.example/'))return Response.json([row()]);
    if(String(url)===EBAY_BUY_AUTH.tokenUrl)return Response.json({access_token:'token',expires_in:7200});
    if(String(url).startsWith('https://api.ebay.com/buy/marketing/'))return Response.json({merchandisedProducts:Array.from({length:25},(_,index)=>({epid:`EPID${index+1}`,title:`Product ${index+1}`}))});
    throw new Error('Unexpected request');
  }});
  const response=await handler(scheduledRequest());
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.published,1);
  assert.equal(result.targets,1);
  const providerCalls=calls.filter(call=>call.url.includes('/buy/marketing/'));
  assert.equal(providerCalls.length,1);
  assert.equal(new URL(providerCalls[0].url).searchParams.get('category_id'),'7000');
});

test('scheduled AliExpress refresh skips provider when its approved Top25 is already recent',async()=>{
  const env={...baseEnv,ALIEXPRESS_APP_KEY:'key',ALIEXPRESS_APP_SECRET:'secret',ALIEXPRESS_TRACKING_ID:'tracking',MPR_ALIEXPRESS_TERMS_APPROVED:'true',MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED:'true',MPR_ALIEXPRESS_API_CURRENT_CONFIRMED:'true',MPR_ALIEXPRESS_TOP25_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryIds:['123']}])};
  const calls=[];
  const handler=createAliExpressCrossMarketRefreshHandler({env,now:()=>now,fetchImpl:async(url)=>{calls.push(String(url));if(String(url).startsWith('https://db.example/'))return Response.json([row('AUTO','ALIEXPRESS_GLOBAL')]);throw new Error('Provider must not be called');}});
  const response=await handler(scheduledRequest());
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,'NOT_DUE');
  assert.equal(calls.length,1);
});

test('failed due lookup cannot trigger eBay provider calls',async()=>{
  const env={...baseEnv,EBAY_CLIENT_ID:'client',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true',MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'true',MPR_EBAY_CROSS_MARKET_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'}])};
  const calls=[];
  const handler=createEbayCrossMarketRefreshHandler({env,now:()=>now,fetchImpl:async(url)=>{calls.push(String(url));return new Response(null,{status:503});}});
  const response=await handler(scheduledRequest());
  assert.equal(response.status,503);
  assert.equal((await response.json()).providerCalls,0);
  assert.equal(calls.length,1);
});
