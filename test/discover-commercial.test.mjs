import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {hasFeature,planByCode} from '../billing-plans.js';
import {commercialPlanRank} from '../commercial-access.js';

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
  assert.match(html,/VERIFIED, ESTIMATED sau DERIVED/);
  assert.match(js,/Amazon web signal/);
  assert.match(js,/TikTok web signal/);
  assert.match(js,/DERIVED/);
  assert.doesNotMatch(`${html}\n${js}`,/unități vândute:\s*\d/i);
  assert.doesNotMatch(js,/soldUnits|verifiedSalesCount/);
});

test('Discover client loads commercial API instead of the raw discovery dataset',async()=>{
  const js=await fs.readFile(new URL('../discover.js',import.meta.url),'utf8');
  assert.match(js,/\/api\/commercial\/discover/);
  assert.match(js,/getCurrentSession/);
  assert.match(js,/authorization/);
  assert.doesNotMatch(js,/fetch\([^\n]*discovery-live\.json/);
  assert.match(js,/Vezi Discover · €17,90/);
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

test('database migration enables new commercial plan codes without breaking legacy rows',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260820_commercial_plans.sql',import.meta.url),'utf8');
  for(const code of ['FREE','DISCOVER','RADAR','LAUNCH','STARTER','PRO','BUSINESS'])assert.match(sql,new RegExp(`'${code}'`));
  assert.match(sql,/alter column plan set default 'FREE'/);
  assert.match(sql,/values\(workspace_name, workspace_slug \|\| .* 'FREE'\)/s);
});
