import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {productKey,watchlistChanges} from '../commercial-watchlist.js';

test('Opportunity Detail uses protected workspace Radar data and strict money language',async()=>{
  const html=await readFile(new URL('../commercial-product.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../commercial-product.js',import.meta.url),'utf8');
  assert.match(js,/\/api\/commercial\/radar/);
  assert.match(js,/x-mpr-workspace-id/);
  assert.match(js,/normalizeOpportunityUxV1/);
  assert.match(js,/Datele lipsă nu sunt transformate în cost zero/);
  assert.match(js,/nu autorizează achiziția/);
  assert.match(html,/Opportunity Detail/);
  assert.doesNotMatch(js,/applyPrivateCommercialDecisions/);
  assert.doesNotMatch(js,/landedEstimate/);
});

test('watchlist key is stable and tenant-safe content does not depend on raw name casing',()=>{
  assert.equal(productKey('  Termometru Digital pentru Carne '),productKey('termometru digital pentru carne'));
  assert.ok(productKey('Produs / Special!').length>0);
});

test('watchlist changes surface strict commercial movement without inventing sales',()=>{
  const item={baseline_action:'HOLD',baseline_readiness:40,baseline_score:50,baseline_landed_confirmed:false,baseline_passed_gates:4};
  const product={score:60,testBuyDecision:{commercialAction:'TEST',commercialReadiness:70,landedCostConfirmed:true,passedGates:9}};
  const changes=watchlistChanges(item,product);
  assert.ok(changes.some(x=>x.code==='ACTION_CHANGED'));
  assert.ok(changes.some(x=>x.code==='LANDED_CONFIRMED'));
  assert.ok(changes.some(x=>x.code==='GATES_PROGRESS'));
  assert.equal(changes.some(x=>/sales|vânz/i.test(x.label)),false);
});

test('watchlist migration is workspace scoped with RLS and unique product key',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260822_commercial_watchlist.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/workspace_members/);
  assert.match(sql,/user_id = auth\.uid\(\)/);
  assert.match(sql,/unique\(workspace_id, product_key\)/);
});

test('Netlify build includes Opportunity Detail and watchlist runtime dependencies',async()=>{
  const build=await readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  for(const file of ['commercial-product.html','commercial-product.js','opportunity-v5.js','opportunity-ux-v1.js','commercial-watchlist.html','commercial-watchlist.js','commercial-watchlist-page.js'])assert.match(build,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
