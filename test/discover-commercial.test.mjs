import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {hasFeature,planByCode} from '../billing-plans.js';

test('commercial Discover tiers preserve the agreed funnel',()=>{
  assert.equal(planByCode('FREE').monthlyPriceEur,0);
  assert.equal(planByCode('DISCOVER').monthlyPriceEur,17.9);
  assert.equal(planByCode('RADAR').monthlyPriceEur,29);
  assert.equal(planByCode('LAUNCH').monthlyPriceEur,89);
  assert.equal(hasFeature('FREE','TOP_PRODUCTS'),false);
  assert.equal(hasFeature('DISCOVER','TOP_PRODUCTS'),true);
  assert.equal(hasFeature('DISCOVER','RADAR'),false);
  assert.equal(hasFeature('RADAR','RADAR'),true);
});

test('Discover UI does not mislabel web proxies as verified sales',async()=>{
  const html=await fs.readFile(new URL('../discover.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../discover.js',import.meta.url),'utf8');
  assert.match(html,/VERIFIED, ESTIMATED sau DERIVED/);
  assert.match(html,/Amazon web signal/);
  assert.match(html,/TikTok web signal/);
  assert.match(js,/DERIVED/);
  assert.doesNotMatch(html,/unități vândute:\s*\d/i);
  assert.doesNotMatch(js,/soldUnits|verifiedSalesCount/);
});

test('Free limits Discover while Radar remains a separate entitlement',async()=>{
  const js=await fs.readFile(new URL('../discover.js',import.meta.url),'utf8');
  assert.match(js,/index>=3/);
  assert.match(js,/hasFeature\(plan\.code,'RADAR'\)/);
  assert.match(js,/Vezi Discover · €17,90/);
});
