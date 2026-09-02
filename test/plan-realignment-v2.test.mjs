import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasFeature,planByCode} from '../billing-plans.js';
import {commercialPlanRank} from '../commercial-access.js';

test('FREE is market intelligence, not supplier or opportunity intelligence',()=>{
  for(const feature of ['CATEGORY_UNIVERSE','CATEGORY_TOP_PRODUCTS','SELLER_BRAND_INTELLIGENCE','MARKET_HISTORY_BASIC'])assert.equal(hasFeature('FREE',feature),true,feature);
  for(const feature of ['SUPPLIERS','SUPPLIER_BENCHMARK','ECONOMICS','ROMANIA_GAP','TRENDING','ACADEMY'])assert.equal(hasFeature('FREE',feature),false,feature);
});

test('DISCOVER adds supplier and economics but not Radar trend opportunity features',()=>{
  for(const feature of ['SUPPLIERS','SUPPLIER_BENCHMARK','LANDED_COST','PROFIT','IMPORT_RISK','ECONOMICS'])assert.equal(hasFeature('DISCOVER',feature),true,feature);
  for(const feature of ['TRENDING','RISING','ROMANIA_GAP','OPPORTUNITY_ENGINE','ACADEMY'])assert.equal(hasFeature('DISCOVER',feature),false,feature);
});

test('RADAR inherits Discover and adds trend Romania Gap opportunity intelligence',()=>{
  for(const feature of ['SUPPLIERS','ECONOMICS','TRENDING','RISING','HISTORY','ALERTS','ROMANIA_GAP','OPPORTUNITY_ENGINE','WATCHLIST'])assert.equal(hasFeature('RADAR',feature),true,feature);
  assert.equal(hasFeature('RADAR','ACADEMY'),false);
});

test('LAUNCH inherits all intelligence and adds execution ecosystem',()=>{
  for(const feature of ['CATEGORY_TOP_PRODUCTS','SUPPLIERS','ECONOMICS','ROMANIA_GAP','OPPORTUNITY_ENGINE','ACADEMY','PARTNER_NETWORK','LAUNCH_PLAN','PORTFOLIO'])assert.equal(hasFeature('LAUNCH',feature),true,feature);
  assert.equal(planByCode('LAUNCH').monthlyPriceEur,89);
});

test('plan order remains Free Discover Radar Launch',()=>{
  assert.deepEqual(['FREE','DISCOVER','RADAR','LAUNCH'].map(commercialPlanRank),[0,1,2,3]);
});

test('pricing presents the four-level roadmap as non-billing interest hypotheses',()=>{
  const html=fs.readFileSync(new URL('../pricing.html',import.meta.url),'utf8');
  const client=fs.readFileSync(new URL('../pricing.js',import.meta.url),'utf8');
  const publicPricing=`${html}\n${client}`;
  assert.match(publicPricing,/Supplier Intelligence \+ benchmark/);
  assert.match(publicPricing,/Trend Intelligence/);
  assert.match(publicPricing,/Romania Gap/);
  assert.match(publicPricing,/Launch Academy/);
  assert.match(publicPricing,/Category Universe \+ Top Products/);
  assert.match(publicPricing,/Vezi topurile gratuite/);
  assert.match(html,/Checkout-ul și abonamentele reale sunt oprite/);
  assert.doesNotMatch(client,/startSubscriptionCheckout/);
});

test('commercial blueprint V2 documents the same product sequence',()=>{
  const md=fs.readFileSync(new URL('../COMMERCIAL_BLUEPRINT.md',import.meta.url),'utf8');
  assert.match(md,/FREE — What is selling\?/);
  assert.match(md,/DISCOVER — Where can I source it and does the economics make sense\?/);
  assert.match(md,/RADAR — What opportunity is emerging/);
  assert.match(md,/LAUNCH — How do I execute and build the business\?/);
  assert.match(md,/100,000\+ canonical products/);
  assert.match(md,/100 products × minimum 3 supplier observations = 300 structured supplier offers/);
});
