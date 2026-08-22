import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {hasFeature,planByCode} from '../billing-plans.js';
import {commercialPlanRank} from '../commercial-access.js';
import {bestEvidence,sortDiscoverProducts} from '../discover-ranking.js';

test('commercial Discover tiers preserve the agreed funnel',()=>{
  assert.equal(planByCode('FREE').monthlyPriceEur,0);
  assert.equal(planByCode('DISCOVER').monthlyPriceEur,17.9);
  assert.equal(planByCode('RADAR').monthlyPriceEur,29);
  assert.equal(planByCode('LAUNCH').monthlyPriceEur,89);
  assert.equal(hasFeature('FREE','TOP_PRODUCTS'),false);
  assert.equal(hasFeature('DISCOVER','TOP_PRODUCTS'),true);
  assert.equal(hasFeature('DISCOVER','RADAR'),false);
  assert.equal(hasFeature('RADAR','RADAR'),true);
  assert.equal(commercialPlanRank('FREE'),0);
  assert.equal(commercialPlanRank('LAUNCH'),3);
});

test('Discover UI does not mislabel web proxies as verified sales',async()=>{
  const html=await fs.readFile(new URL('../discover.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../discover.js',import.meta.url),'utf8');
  const ranking=await fs.readFile(new URL('../discover-ranking.js',import.meta.url),'utf8');
  assert.match(html,/VERIFIED, ESTIMATED sau DERIVED/);
  assert.match(js,/Amazon evidence/);
  assert.match(js,/TikTok evidence/);
  assert.match(`${js}\n${ranking}`,/VERIFIED/);
  assert.match(`${js}\n${ranking}`,/DERIVED/);
  assert.doesNotMatch(`${html}\n${js}\n${ranking}`,/unități vândute:\s*\d/i);
  assert.doesNotMatch(`${js}\n${ranking}`,/soldUnits|verifiedSalesCount/);
});

test('Discover client loads commercial API instead of the raw discovery dataset',async()=>{
  const js=await fs.readFile(new URL('../discover.js',import.meta.url),'utf8');
  assert.match(js,/\/api\/commercial\/discover/);
  assert.match(js,/getCurrentSession/);
  assert.match(js,/authorization/);
  assert.doesNotMatch(js,/fetch\([^\n]*discovery-live\.json/);
  assert.match(js,/Vezi Discover · €17,90/);
});

test('Discover cards show verified images first and a clearly labeled representative fallback',async()=>{
  const html=await fs.readFile(new URL('../discover.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../discover.js',import.meta.url),'utf8');
  assert.match(js,/p\.imageUrl/);
  assert.match(js,/representativeImageUrl/);
  assert.match(js,/tse1\.mm\.bing\.net/);
  assert.match(js,/Imagine reprezentativă/);
  assert.match(js,/data-fallback/);
  assert.match(html,/\.media-note/);
  assert.match(html,/imagine reprezentativă, marcată explicit/i);
});

test('Discover prioritizes verified observed evidence over higher derived score',()=>{
  const derived={name:'Derived',discoveryAnalysis:{score:95},signals:{}};
  const verified={name:'Verified',discoveryAnalysis:{score:40},signals:{amazonDE:{present:true,evidenceClass:'VERIFIED',links:[{url:'https://example.com/product'}]}}};
  const ordered=sortDiscoverProducts([derived,verified],'BEST');
  assert.equal(ordered[0].name,'Verified');
  assert.deepEqual(bestEvidence(verified),{platform:'AMAZON',market:'Amazon DE',evidenceClass:'VERIFIED',url:'https://example.com/product',searchUrl:'',title:'',observed:true,direct:true});
});

test('Discover source block never invents a verified source',()=>{
  const none=bestEvidence({name:'No evidence',discoveryAnalysis:{score:99},signals:{}});
  assert.equal(none.observed,false);
  assert.equal(none.market,'Fără sursă verificată');
  assert.equal(none.evidenceClass,'DERIVED');
});

test('commercial endpoint enforces server-side product limits and strips sourcing economics',async()=>{
  const fn=await fs.readFile(new URL('../netlify/functions/commercial-discover.mjs',import.meta.url),'utf8');
  assert.match(fn,/const limit=full\?20:3/);
  assert.match(fn,/\/auth\/v1\/user/);
  assert.match(fn,/\/rest\/v1\/workspaces/);
  assert.match(fn,/Vary':'Authorization/);
  assert.doesNotMatch(fn,/sourcing:/);
  assert.doesNotMatch(fn,/landedEstimate:/);
});

test('Discover fuses only quality-gated Organic Rising evidence and never fabricates TikTok',async()=>{
  const fn=await fs.readFile(new URL('../netlify/functions/commercial-discover.mjs',import.meta.url),'utf8');
  const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  assert.match(fn,/organic-rising-live\.json/);
  assert.match(fn,/eligibleForFeed/);
  assert.match(fn,/qualityGate\?\.topTwoPages/);
  assert.match(fn,/qualityGate\?\.notPromoted/);
  assert.match(fn,/evidenceClass:'VERIFIED'/);
  assert.match(fn,/mergeProducts/);
  assert.match(build,/organic-rising-live\.json/);
  assert.match(build,/discover-ranking\.js/);
  assert.doesNotMatch(fn,/tiktok[^\n]*present:true/i);
});

test('database migration enables new commercial plan codes without breaking legacy rows',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260820_commercial_plans.sql',import.meta.url),'utf8');
  for(const code of ['FREE','DISCOVER','RADAR','LAUNCH','STARTER','PRO','BUSINESS'])assert.match(sql,new RegExp(`'${code}'`));
  assert.match(sql,/alter column plan set default 'FREE'/);
  assert.match(sql,/values\(workspace_name, workspace_slug \|\| .* 'FREE'\)/s);
});
