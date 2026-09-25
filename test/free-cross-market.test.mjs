import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {
  FREE_CROSS_MARKET_PLATFORMS,
  buildFreeCrossMarketExperience,
  crossMarketSnapshotKey,
  normalizeCrossMarketSnapshot
} from '../free-cross-market-registry.js';
import {createFreeCrossMarketHandler,filterPublicDisplaySnapshots} from '../netlify/functions/free-cross-market.mjs';

const product=index=>({
  name:`Generic product ${index}`,
  externalId:`item-${index}`,
  conceptKey:`generic-concept-${index}`,
  rank:index,
  sourceUrl:`https://www.ebay.com/itm/${index}`,
  observedAt:'2026-09-03T06:00:00Z',
  sourceKey:'EBAY_MARKETING_API',
  rankingBasis:'BEST_SELLING',
  evidenceClass:'DIRECT'
});

test('Free Cross-Market registry exposes comparison surfaces without leaking credential names',async()=>{
  assert.deepEqual(FREE_CROSS_MARKET_PLATFORMS.map(x=>x.id),['CONSENSUS','ALIEXPRESS','EBAY','AMAZON_US','AMAZON_DE','TIKTOK','GOOGLE','ROMANIA']);
  const view=buildFreeCrossMarketExperience({env:{},now:new Date('2026-09-03T08:00:00Z')});
  assert.equal('archivePositions' in view.coverage,false);
  assert.equal(view.coverage.livePositions,0);
  assert.equal(view.coverage.consensusReady,false);

  assert.equal(view.platforms.find(x=>x.id==='EBAY').status,'ACCESS_REQUIRED');
  assert.equal(JSON.stringify(view).includes('EBAY_OAUTH_TOKEN'),false);
  const browserModule=await fs.readFile(new URL('../free-cross-market-registry.js',import.meta.url),'utf8');
  assert.doesNotMatch(browserModule,/(?:TOKEN|SECRET|APP_KEY|TERMS_APPROVED)/);
  assert.equal(view.policy.noSyntheticRankings,true);
});

test('a live platform ranking is published only with exactly 25 fresh valid positions',()=>{
  const snapshot={niche_id:crossMarketSnapshotKey('EBAY','AUTO'),reviewed_at:'2026-09-03',products:Array.from({length:25},(_,i)=>product(i+1))};
  const normalized=normalizeCrossMarketSnapshot(snapshot,{now:new Date('2026-09-04T08:00:00Z')});
  assert.equal(normalized.products.length,25);
  assert.equal(normalized.platform,'EBAY');
  assert.equal(normalized.products[0].salesEvidenceClass,'PLATFORM_RANK_NOT_UNIT_SALES');
  assert.equal(normalizeCrossMarketSnapshot({...snapshot,products:snapshot.products.slice(0,24)},{now:new Date('2026-09-04T08:00:00Z')}),null);
  assert.equal(normalizeCrossMarketSnapshot({...snapshot,reviewed_at:'2026-08-01'},{now:new Date('2026-09-04T08:00:00Z')}),null);
});

test('current snapshot rows require approved rights and current freshness',()=>{
  const products=Array.from({length:25},(_,i)=>product(i+1));
  const row={niche_id:'AUTO',platform:'EBAY',market:'EBAY_US',window_end:'2026-09-03T06:00:00Z',product_count:25,products,source_rights_status:'APPROVED',freshness_status:'CURRENT'};
  assert.equal(normalizeCrossMarketSnapshot(row,{now:new Date('2026-09-04T08:00:00Z')})?.products.length,25);
  assert.equal(normalizeCrossMarketSnapshot({...row,source_rights_status:'REVIEW_REQUIRED'},{now:new Date('2026-09-04T08:00:00Z')}),null);
  assert.equal(normalizeCrossMarketSnapshot({...row,freshness_status:'STALE'},{now:new Date('2026-09-04T08:00:00Z')}),null);
});

test('demand, advertising and Romanian comparable data remain supporting signals',()=>{
  const view=buildFreeCrossMarketExperience({accessByPlatform:{GOOGLE:'READY_TO_COLLECT',TIKTOK:'READY_TO_COLLECT',ROMANIA:'READY_TO_COLLECT'}});
  for(const id of ['GOOGLE','TIKTOK','ROMANIA'])assert.equal(view.platforms.find(row=>row.id===id).status,'SUPPORTING_SIGNAL_ONLY');
});

test('consensus becomes ready only after 25 concepts match across two independent live platforms',()=>{
  const products=Array.from({length:25},(_,i)=>product(i+1));
  const ebay={niche_id:'XMARKET:EBAY:AUTO',reviewed_at:'2026-09-03',products};
  const ali={niche_id:'XMARKET:ALIEXPRESS:AUTO',reviewed_at:'2026-09-03',products:products.map((row,index)=>({...row,externalId:`ali-${index}`,sourceUrl:`https://www.aliexpress.com/item/${index}.html`,sourceKey:'ALIEXPRESS_HOT_PRODUCTS_API',rankingBasis:'HOT_PRODUCTS'}))};
  const one=buildFreeCrossMarketExperience({snapshots:[ebay],now:new Date('2026-09-04T08:00:00Z')});
  const two=buildFreeCrossMarketExperience({snapshots:[ebay,ali],now:new Date('2026-09-04T08:00:00Z')});
  assert.equal(one.coverage.consensusReady,false);
  assert.equal(two.coverage.consensusReady,true);
  assert.equal(two.platforms.find(x=>x.id==='CONSENSUS').status,'LIVE');
  const consensus=two.rankings.find(x=>x.platform==='CONSENSUS');
  assert.equal(consensus.products.length,25);
  assert.deepEqual(consensus.products[0].platformConfirmations,['ALIEXPRESS','EBAY']);
});

test('Free Cross-Market endpoint returns live coverage and fails closed on missing live snapshots',async()=>{
  const fetchImpl=async url=>{
    const value=String(url);
    if(value.includes('/rpc/consume_api_rate_limit'))return Response.json([{allowed:true,limit:90,hitCount:1}]);
    if(value.includes('/rest/v1/current_top25_snapshots_v1'))return Response.json([]);
    if(value.includes('/rest/v1/top25_snapshots'))return Response.json([]);
    return new Response('not found',{status:404});
  };
  const handler=createFreeCrossMarketHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service',SECURITY_AUDIT_SALT:'salt'},now:()=>new Date('2026-09-03T08:00:00Z')});
  const response=await handler(new Request('https://mpr.example/api/free/cross-market'));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.coverage.livePositions,0);
  assert.equal(body.policy.noSyntheticRankings,true);
});

test('revoking the public-display flag removes an approved current snapshot from the public API',async()=>{
  const snapshot={niche_id:'AUTO',platform:'EBAY',market:'EBAY_US',window_end:'2026-09-03T06:00:00Z',product_count:25,products:Array.from({length:25},(_,i)=>product(i+1)),source_rights_status:'APPROVED',freshness_status:'CURRENT'};
  const fetchImpl=async url=>{
    if(String(url).includes('/rpc/consume_api_rate_limit'))return Response.json([{allowed:true,limit:90,hitCount:1}]);
    if(String(url).includes('/rest/v1/current_top25_snapshots_v1'))return Response.json([snapshot]);
    return new Response('not found',{status:404});
  };
  const baseEnv={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service',SECURITY_AUDIT_SALT:'salt'};
  const request=()=>new Request('https://mpr.example/api/free/cross-market');
  const now=()=>new Date('2026-09-03T08:00:00Z');
  const approvedHandler=createFreeCrossMarketHandler({fetch:fetchImpl,env:{...baseEnv,MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'true'},now});
  const approvedResponse=await approvedHandler(request());
  assert.equal((await approvedResponse.json()).coverage.livePositions,25);
  assert.equal(approvedResponse.headers.get('cache-control'),'public, max-age=60');
  const revokedHandler=createFreeCrossMarketHandler({fetch:fetchImpl,env:{...baseEnv,MPR_EBAY_PUBLIC_DISPLAY_APPROVED:'false'},now});
  const revokedResponse=await revokedHandler(request());
  const revoked=await revokedResponse.json();
  assert.equal(revoked.coverage.livePositions,0);
  assert.deepEqual(revoked.rankings,[]);
});

test('an Amazon licensed feed cannot inherit Keepa display approval',()=>{
  const keepa={platform:'AMAZON_US',source_key:'KEEPA_BEST_SELLERS'};
  const licensed={platform:'AMAZON_US',source_key:'AMAZON_LICENSED_BEST_SELLERS'};
  const env={MPR_KEEPA_PUBLIC_DISPLAY_APPROVED:'true'};
  assert.deepEqual(filterPublicDisplaySnapshots([keepa,licensed],env),[keepa]);
  assert.deepEqual(filterPublicDisplaySnapshots([licensed],{MPR_AMAZON_LICENSED_PUBLIC_DISPLAY_APPROVED:'true'}),[licensed]);
  assert.deepEqual(filterPublicDisplaySnapshots([{platform:'AMAZON_US'}],env),[]);
});
