import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeepaTop25CollectHandler} from '../netlify/functions/keepa-top25-collect.mjs';
import {parseKeepaTargets,keepaCollectionAccessState,reserveKeepaBudget,collectKeepaCandidates} from '../netlify/functions/_keepa-top25.mjs';

const now=new Date('2026-09-25T12:00:00Z');
const keepaMinutes=iso=>Date.parse(iso)/60_000-21_564_000;
const target={nicheId:'BIROU_ORGANIZARE',domain:1,categoryId:'12345',mappingStatus:'APPROVED',reviewer:'Category reviewer',reviewedAt:'2026-09-24T12:00:00Z',categoryEvidenceUrl:'https://www.amazon.com/gp/bestsellers/office-products/12345'};
const env=()=>({MPR_INTERNAL_REFRESH_SECRET:'internal-test',KEEPA_API_KEY:'provider-secret-test',MPR_KEEPA_TERMS_APPROVED:'true',MPR_KEEPA_PUBLIC_DISPLAY_APPROVED:'true',MPR_PAID_PROVIDER_CALLS_ENABLED:'true',MPR_KEEPA_COLLECTION_ENABLED:'true',MPR_KEEPA_DAILY_TOKEN_CAP:'150',MPR_KEEPA_TOP25_TARGETS_JSON:JSON.stringify([target])});
const asins=Array.from({length:105},(_,index)=>`B${String(index).padStart(9,'0')}`);
const list=()=>({bestSellersList:{domainId:1,categoryId:'12345',lastUpdate:keepaMinutes('2026-09-25T10:00:00Z'),asinList:asins}});
const products=()=>({products:asins.map(asin=>({asin,domainId:1,title:`Desk tray ${asin}`,brand:'Independent maker',lastUpdate:keepaMinutes('2026-09-25T09:00:00Z')}))});
function memoryStore(){
  const rows=new Map();let version=0;
  return {rows,async getWithMetadata(key){return structuredClone(rows.get(key)||null);},async get(key){return structuredClone(rows.get(key)?.data||null);},async setJSON(key,data,options={}){
    const existing=rows.get(key);
    if(options.onlyIfNew&&existing||options.onlyIfMatch&&existing?.etag!==options.onlyIfMatch)return {modified:false};
    rows.set(key,{data:structuredClone(data),etag:String(++version)});return {modified:true};
  }};
}
const request=(body={nicheId:target.nicheId},secret='internal-test')=>new Request('https://mpr.example/api/internal/keepa-top25-collect',{method:'POST',headers:{'x-mpr-internal-secret':secret,'content-type':'application/json'},body:JSON.stringify(body)});

test('Keepa collection requires reviewed mapping, rights, credentials and explicit capped spending',async()=>{
  for(const [key,value] of [['KEEPA_API_KEY',''],['MPR_KEEPA_TERMS_APPROVED','false'],['MPR_KEEPA_PUBLIC_DISPLAY_APPROVED','false'],['MPR_PAID_PROVIDER_CALLS_ENABLED','false'],['MPR_KEEPA_COLLECTION_ENABLED','false'],['MPR_KEEPA_DAILY_TOKEN_CAP','0'],['MPR_KEEPA_DAILY_TOKEN_CAP','3751'],['MPR_KEEPA_DAILY_TOKEN_CAP','Infinity']]){
    const config={...env(),[key]:value};assert.notEqual(keepaCollectionAccessState(config),'READY_TO_COLLECT');
    const handler=createKeepaTop25CollectHandler({env:config,now:()=>now,storeFactory:()=>{throw Error('must not allocate store');},fetchImpl:()=>{throw Error('must not call provider');}});
    assert.equal((await handler(request())).status,409,key);
  }
  for(const change of [{mappingStatus:'PENDING'},{reviewedAt:'2026-01-01'},{reviewedAt:'2027-01-01'},{categoryEvidenceUrl:'https://evil.example/12345'},{domain:3},{nicheId:'UNKNOWN'},{categoryId:'1&key=other'}])assert.deepEqual(parseKeepaTargets({...env(),MPR_KEEPA_TOP25_TARGETS_JSON:JSON.stringify([{...target,...change}])},now),[]);
  const handler=createKeepaTop25CollectHandler({env:env(),now:()=>now,fetchImpl:()=>{throw Error('must not call provider');}});
  assert.equal((await handler(request({},'wrong'))).status,401);
  assert.equal((await handler(request({nicheId:'UNKNOWN'}))).status,409);
});

test('atomic daily budget blocks simultaneous duplicate runs and cross-niche overspend',async()=>{
  const store=memoryStore();
  const results=await Promise.all(Array.from({length:8},()=>reserveKeepaBudget(store,{day:'2026-09-25',nicheId:target.nicheId,cap:150})));
  assert.equal(results.filter(result=>result.ok).length,1);
  assert.equal((await reserveKeepaBudget(store,{day:'2026-09-25',nicheId:'CALATORII',cap:150})).code,'DAILY_TOKEN_CAP_REACHED');
  const second=await reserveKeepaBudget(store,{day:'2026-09-26',nicheId:target.nicheId,cap:150});assert.equal(second.ok,true);
});

test('collection preserves source ranks and dates, limits hydration and excludes established brands',async()=>{
  const calls=[],identities=products();identities.products[0].brand='Nike';
  identities.products[1].lastUpdate=keepaMinutes('2026-09-20T09:00:00Z');
  identities.products[2].domainId=3;
  const result=await collectKeepaCandidates({target,env:env(),now,fetchImpl:async(url,options)=>{calls.push({url:new URL(url),options});return Response.json(calls.length===1?list():identities);}});
  assert.equal(result.ok,true);assert.equal(result.batch.candidates.length,97);
  assert.equal(result.batch.candidates[0].sourceRank,4);
  assert.equal(result.batch.candidates[0].observedAt,'2026-09-25T09:00:00.000Z');
  assert.equal(result.batch.candidates[0].sourceUpdatedAt,'2026-09-25T10:00:00.000Z');
  assert.equal(result.batch.candidates[0].fetchedAt,now.toISOString());
  assert.equal(calls.length,2);assert.equal(calls[0].url.searchParams.get('sublist'),'1');
  assert.equal(calls[0].url.searchParams.has('range'),false);
  assert.equal(calls[1].url.searchParams.get('asin').split(',').length,100);
  assert.equal(calls[1].url.searchParams.get('update'),'-1');
  assert.equal(calls[1].url.searchParams.get('history'),'0');
  for(const call of calls){assert.equal(call.options.redirect,'error');assert.ok(call.options.signal);assert.equal(call.url.searchParams.has('offers'),false);}
  assert.deepEqual(result.batch.reviews,{});assert.equal(result.batch.published,0);
});

test('old or wrong-market lists never cause a second paid request',async()=>{
  for(const overrides of [{lastUpdate:keepaMinutes('2026-09-20T09:00:00Z')},{domainId:3},{categoryId:'99'},{asinList:asins.slice(0,24)}]){
    let calls=0;const payload=list();Object.assign(payload.bestSellersList,overrides);
    const result=await collectKeepaCandidates({target,env:env(),now,fetchImpl:async()=>{calls++;return Response.json(payload);}});
    assert.equal(result.ok,false);assert.equal(calls,1);
  }
});

test('provider failure cannot leak a URL secret or spend again on a retry',async()=>{
  const store=memoryStore();let calls=0;
  const handler=createKeepaTop25CollectHandler({env:env(),now:()=>now,storeFactory:()=>store,fetchImpl:async url=>{calls++;throw Error(String(url));}});
  const first=await handler(request()),body=await first.text();
  assert.equal(first.status,422);assert.doesNotMatch(body,/provider-secret-test|api\.keepa\.com/);
  assert.equal((await (await handler(request())).json()).status,'ALREADY_RESERVED_TODAY');
  assert.equal(calls,1);
});

test('successful collection stores a private review batch and never writes public snapshots',async()=>{
  const store=memoryStore();let calls=0;
  const handler=createKeepaTop25CollectHandler({env:env(),now:()=>now,storeFactory:()=>store,fetchImpl:async url=>{assert.equal(new URL(url).hostname,'api.keepa.com');calls++;return Response.json(calls===1?list():products());}});
  const response=await handler(request()),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.status,'HUMAN_REVIEW_REQUIRED');assert.equal(body.published,0);assert.equal(body.reservedTokens,150);
  const read=()=>new Request(`https://mpr.example/api/internal/keepa-top25-collect?nicheId=${target.nicheId}&day=2026-09-25`,{headers:{'x-mpr-internal-secret':'internal-test'}});
  const fetched=await handler(read());assert.equal(fetched.headers.get('cache-control'),'private, no-store');
  const privateBatch=await fetched.json();assert.equal(privateBatch.batch.candidates.length,100);assert.deepEqual(privateBatch.batch.reviews,{});
  assert.doesNotMatch(JSON.stringify([...store.rows]),/provider-secret-test|internal-test/);
  assert.equal((await handler(new Request(read().url))).status,401);
});

test('unavailable persistence fails before consuming provider tokens',async()=>{
  let calls=0;
  const handler=createKeepaTop25CollectHandler({env:env(),now:()=>now,storeFactory:()=>{throw Error('store unavailable');},fetchImpl:async()=>{calls++;}});
  assert.equal((await handler(request())).status,503);assert.equal(calls,0);
});
