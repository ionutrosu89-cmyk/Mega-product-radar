import assert from 'node:assert/strict';
import test from 'node:test';
import {EBAY_BUY_AUTH,resetEbayTokenCacheForTests} from '../netlify/functions/_ebay-buy-auth.mjs';
import {collectEbayBestSellingTarget,normalizeEbayBestSelling,parseEbayTargets} from '../netlify/functions/_ebay-best-selling.mjs';
import {createEbayCrossMarketRefreshHandler} from '../netlify/functions/ebay-cross-market-refresh.mjs';

const approvedEnv={
  EBAY_CLIENT_ID:'client',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true',
  MPR_EBAY_CROSS_MARKET_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'}]),
  MPR_INTERNAL_REFRESH_SECRET:'internal-secret',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service'
};
const payload=count=>({merchandisedProducts:Array.from({length:count},(_,i)=>({epid:`EPID${i+1}`,title:`Product ${i+1}`,averageRating:'4.5',reviewCount:i+10}))});

test('eBay target parser accepts only explicit category mappings',()=>{
  assert.deepEqual(parseEbayTargets(approvedEnv),[{nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'}]);
  assert.deepEqual(parseEbayTargets({MPR_EBAY_CROSS_MARKET_TARGETS_JSON:'not-json'}),[]);
  assert.deepEqual(parseEbayTargets({MPR_EBAY_CROSS_MARKET_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryId:'not-a-category'}])}),[]);
});

test('eBay normalizer fails closed unless 25 ranked products are usable',()=>{
  const target={nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'};
  assert.equal(normalizeEbayBestSelling(payload(24),{target}).length,0);
  const rows=normalizeEbayBestSelling(payload(25),{target,observedAt:'2026-09-04T06:00:00Z'});
  assert.equal(rows.length,25);
  assert.equal(rows[0].rank,1);
  assert.equal(rows[0].rankingBasis,'BEST_SELLING');
  assert.equal(rows[0].salesEvidenceClass,'PLATFORM_RANK_NOT_UNIT_SALES');
  assert.match(rows[0].sourceUrl,/^https:\/\/www\.ebay\.com\/p\/EPID1$/);
});

test('collector uses Buy Marketing scope, category, marketplace and exact limit 25',async()=>{
  resetEbayTokenCacheForTests();
  const calls=[];
  const fetchImpl=async (url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url)===EBAY_BUY_AUTH.tokenUrl)return Response.json({access_token:'token',expires_in:7200});
    return Response.json(payload(25));
  };
  const result=await collectEbayBestSellingTarget({target:{nicheId:'AUTO',categoryId:'6000',marketplaceId:'EBAY_US'},env:approvedEnv,fetchImpl,now:()=>new Date('2026-09-04T06:00:00Z')});
  assert.equal(result.ok,true);
  assert.equal(calls.length,2);
  assert.match(String(calls[0].options.body),/buy\.marketing/);
  const provider=new URL(calls[1].url);
  assert.equal(provider.pathname,'/buy/marketing/v1/merchandised_product');
  assert.equal(provider.searchParams.get('category_id'),'6000');
  assert.equal(provider.searchParams.get('metric_name'),'BEST_SELLING');
  assert.equal(provider.searchParams.get('limit'),'25');
  assert.equal(calls[1].options.headers['X-EBAY-C-MARKETPLACE-ID'],'EBAY_US');
});

test('internal refresh makes zero provider calls until access is approved',async()=>{
  let called=0;
  const handler=createEbayCrossMarketRefreshHandler({env:{...approvedEnv,MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'false'},fetchImpl:async()=>{called++;return Response.json({});}});
  const response=await handler(new Request('https://mpr.example/api/internal/ebay-cross-market-refresh',{method:'POST',headers:{'x-mpr-internal-secret':'internal-secret'}}));
  assert.equal(response.status,409);
  assert.equal(called,0);
  assert.equal((await response.json()).providerCalls,0);
});

test('internal refresh persists only a complete 25-product snapshot',async()=>{
  resetEbayTokenCacheForTests();
  const calls=[];
  const fetchImpl=async (url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url)===EBAY_BUY_AUTH.tokenUrl)return Response.json({access_token:'token',expires_in:7200});
    if(String(url).startsWith('https://api.ebay.com/buy/marketing/'))return Response.json(payload(25));
    if(String(url).startsWith('https://db.example/rest/v1/top25_snapshots'))return new Response(null,{status:201});
    return new Response('not found',{status:404});
  };
  const handler=createEbayCrossMarketRefreshHandler({env:approvedEnv,fetchImpl,now:()=>new Date('2026-09-04T06:00:00Z')});
  const response=await handler(new Request('https://mpr.example/api/internal/ebay-cross-market-refresh',{method:'POST',headers:{'x-mpr-internal-secret':'internal-secret'}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.published,1);
  const write=calls.find(call=>call.url.includes('/rest/v1/top25_snapshots'));
  assert.ok(write);
  const stored=JSON.parse(write.options.body)[0];
  assert.equal(stored.niche_id,'XMARKET:EBAY:AUTO');
  assert.equal(stored.reviewed_at,'2026-09-04');
  assert.equal(stored.products.length,25);
});
