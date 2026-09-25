import assert from 'node:assert/strict';
import test from 'node:test';
import {createTop25LiveIngestHandler} from '../netlify/functions/top25-live-ingest.mjs';

const products=()=>Array.from({length:25},(_,i)=>({name:`Product ${i+1}`,externalId:`EPID-${i+1}`,rank:i+1,sourceUrl:`https://www.ebay.com/p/EPID-${i+1}`,observedAt:'2026-09-20T06:00:00Z',sourceLabel:'eBay'}));
const snapshot=()=>({nicheId:'AUTO',platform:'EBAY',market:'EBAY_US',sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',sourceLabel:'eBay Buy Marketing API',products:products()});

test('protected live ingest persists one complete approved current snapshot',async()=>{
  const calls=[];
  const env={MPR_INTERNAL_REFRESH_SECRET:'internal',MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'true',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service'};
  const handler=createTop25LiveIngestHandler({env,now:()=>new Date('2026-09-20T07:00:00Z'),fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return new Response(null,{status:201});}});
  const response=await handler(new Request('https://mpr.example/api/internal/top25-live-ingest',{method:'POST',headers:{'content-type':'application/json','x-mpr-internal-secret':'internal'},body:JSON.stringify({snapshots:[snapshot()]})}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).published,1);
  const stored=JSON.parse(calls[0].options.body)[0];
  assert.equal(stored.product_count,25);
  assert.equal(stored.source_rights_status,'APPROVED');
});

test('live ingest performs no write without public display approval',async()=>{
  let calls=0;
  const handler=createTop25LiveIngestHandler({env:{MPR_INTERNAL_REFRESH_SECRET:'internal'},now:()=>new Date('2026-09-20T07:00:00Z'),fetchImpl:async()=>{calls++;return new Response(null,{status:201});}});
  const response=await handler(new Request('https://mpr.example/api/internal/top25-live-ingest',{method:'POST',headers:{'content-type':'application/json','x-mpr-internal-secret':'internal'},body:JSON.stringify({snapshots:[snapshot()]})}));
  assert.equal(response.status,422);
  assert.equal(calls,0);
  assert.equal((await response.json()).results[0].status,'PUBLIC_DISPLAY_RIGHTS_REQUIRED');
});

test('Keepa approval cannot publish a different licensed Amazon feed',async()=>{
  let calls=0;
  const amazon={nicheId:'AUTO',platform:'AMAZON_US',market:'AMAZON_US',sourceKey:'AMAZON_LICENSED_BEST_SELLERS',products:products().map((row,index)=>({...row,externalId:`ASIN-${index+1}`,sourceUrl:`https://www.amazon.com/dp/ASIN-${index+1}`}))};
  const handler=createTop25LiveIngestHandler({env:{MPR_INTERNAL_REFRESH_SECRET:'internal',MPR_KEEPA_PUBLIC_DISPLAY_APPROVED:'true'},now:()=>new Date('2026-09-20T07:00:00Z'),fetchImpl:async()=>{calls++;return new Response(null,{status:201});}});
  const response=await handler(new Request('https://mpr.example/api/internal/top25-live-ingest',{method:'POST',headers:{'content-type':'application/json','x-mpr-internal-secret':'internal'},body:JSON.stringify({snapshots:[amazon]})}));
  assert.equal(response.status,422);
  assert.equal(calls,0);
  assert.equal((await response.json()).results[0].status,'PUBLIC_DISPLAY_RIGHTS_REQUIRED');
});

test('curated generic ingest stores MPR rank separately and requires source-specific rights',async()=>{
  const candidates=Array.from({length:26},(_,index)=>({name:index===0?'Nike shoes':`Desk organizer ${index}`,externalId:`item-${index}`,sourceRank:index+1,nicheId:'BIROU_ORGANIZARE',sourceUrl:`https://www.ebay.com/itm/${index}`,observedAt:'2026-09-20T06:00:00Z'}));
  const reviews=Object.fromEntries(candidates.map(row=>[row.externalId,{decision:'GENERIC_PRIVATE_LABEL',reviewer:'Analyst',reviewedAt:'2026-09-20T06:00:00Z',evidenceUrl:'https://review.example/brand',nicheId:'BIROU_ORGANIZARE',nicheDecision:'IN_SCOPE',nicheEvidenceUrl:'https://review.example/niche',conceptKey:`CONCEPT_${row.externalId}`} ]));
  const curated={nicheId:'BIROU_ORGANIZARE',platform:'MPR_GENERIC',sourcePlatform:'EBAY',market:'EBAY_US',sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',candidates,reviews};
  const request=()=>new Request('https://mpr.example/api/internal/top25-live-ingest',{method:'POST',headers:{'content-type':'application/json','x-mpr-internal-secret':'internal'},body:JSON.stringify({snapshots:[curated]})});
  const calls=[];
  const baseEnv={MPR_INTERNAL_REFRESH_SECRET:'internal',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service'};
  const fetchImpl=async(url,options)=>{calls.push({url:String(url),options});return new Response(null,{status:201});};
  const denied=createTop25LiveIngestHandler({env:baseEnv,now:()=>new Date('2026-09-20T07:00:00Z'),fetchImpl});
  assert.equal((await (await denied(request())).json()).results[0].status,'PUBLIC_DISPLAY_RIGHTS_REQUIRED');
  assert.equal(calls.length,0);
  const approved=createTop25LiveIngestHandler({env:{...baseEnv,MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'true'},now:()=>new Date('2026-09-20T07:00:00Z'),fetchImpl});
  assert.equal((await (await approved(request())).json()).published,1);
  const stored=JSON.parse(calls[0].options.body)[0];
  assert.equal(stored.platform,'MPR_GENERIC');
  assert.equal(stored.products[0].rank,1);
  assert.equal(stored.products[0].sourceRank,2);
  assert.equal(stored.products[24].sourceRank,26);
});
