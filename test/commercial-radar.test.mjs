import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {createCommercialRadarHandler} from '../netlify/functions/commercial-radar.mjs';

function mockFetch(plan='RADAR'){
  return async url=>{
    const u=String(url);
    if(u.includes('/auth/v1/user'))return Response.json({id:'u1'});
    if(u.includes('/rest/v1/workspaces'))return Response.json([{id:'w1',name:'Radar',plan}]);
    if(u.includes('/radar-live.json'))return Response.json({updatedAt:'2026-08-20T00:00:00Z',products:[{name:'Test product',cat:'Home',score:82,gap:64,sourcing:[{url:'secret-supplier'}],landedEstimate:12,sellTarget:79,romaniaDemand:{readyForTestDemandGate:true},salesEstimation:{status:'ESTIMATED_HIGH_CONFIDENCE',confidence:80,estimatedUnits30d:100},dataConfidence:{overall:60},trendIntelligence:{status:'RISING'}}]});
    return new Response(null,{status:404});
  };
}

test('Discover plan cannot access protected commercial Radar payload',async()=>{
  const handler=createCommercialRadarHandler({fetch:mockFetch('DISCOVER'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'}});
  const response=await handler(new Request('https://radar.example/api/commercial/radar',{headers:{authorization:'Bearer token'}}));
  assert.equal(response.status,403);
  const body=await response.json();
  assert.equal(body.plan,'DISCOVER');
});

test('Radar plan gets decision inputs without supplier sourcing payload',async()=>{
  const handler=createCommercialRadarHandler({fetch:mockFetch('RADAR'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'}});
  const response=await handler(new Request('https://radar.example/api/commercial/radar',{headers:{authorization:'Bearer token'}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.plan,'RADAR');
  assert.equal(body.products.length,1);
  assert.equal(body.products[0].name,'Test product');
  assert.equal(body.products[0].score,82);
  assert.deepEqual(body.products[0].derivedRomaniaGap,{score:64,evidence:'DERIVED_PROXY'});
  assert.equal('sourcing' in body.products[0],false);
  assert.equal('landedEstimate' in body.products[0],false);
  assert.equal(body.integrity.moneyGate,'CONFIRMED_LANDED_COST_REQUIRED');
  assert.equal(body.integrity.legacyScore,'DERIVED_DISPLAY_ONLY');
  assert.equal(body.integrity.legacyRomaniaGap,'DERIVED_PROXY_DISPLAY_ONLY');
});

test('commercial Radar live source exists in the Netlify static build',async()=>{
  const fn=await fs.readFile(new URL('../netlify/functions/commercial-radar.mjs',import.meta.url),'utf8');
  const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  assert.match(fn,/new URL\('\/radar-live\.json'/);
  assert.doesNotMatch(fn,/market-intelligence-live\.json/);
  assert.match(build,/'radar-live\.json'/);
  await fs.access(new URL('../radar-live.json',import.meta.url));
});

test('commercial Radar UI uses private nine-gate decision engine',async()=>{
  const html=await fs.readFile(new URL('../commercial-radar.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../commercial-radar.js',import.meta.url),'utf8');
  assert.match(html,/toate cele 9 gate-uri/);
  assert.match(html,/landed cost confirmat/i);
  assert.match(js,/applyPrivateCommercialDecisions/);
  assert.match(js,/\/api\/commercial\/radar/);
  assert.match(js,/commercialReadiness/);
  assert.match(js,/DERIVED SCORE/);
  assert.match(js,/DERIVED /);
  assert.doesNotMatch(js,/landedEstimate/);
});
