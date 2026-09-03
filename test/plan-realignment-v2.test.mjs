import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasFeature,planByCode} from '../billing-plans.js';
import {commercialPlanRank} from '../commercial-access.js';

test('FREE is market intelligence, not supplier or opportunity intelligence',()=>{
  for(const feature of ['CATEGORY_UNIVERSE','CATEGORY_TOP_PRODUCTS','SELLER_BRAND_INTELLIGENCE','MARKET_HISTORY_BASIC'])assert.equal(hasFeature('FREE',feature),true,feature);
  for(const feature of ['SUPPLIERS','SUPPLIER_BENCHMARK','ECONOMICS','ROMANIA_GAP','TRENDING','ACADEMY'])assert.equal(hasFeature('FREE',feature),false,feature);
});

test('DISCOVER adds global trend intelligence before commercial execution',()=>{
  for(const feature of ['TRENDING','RISING','HISTORY','FILTERS','ALERTS'])assert.equal(hasFeature('DISCOVER',feature),true,feature);
  for(const feature of ['SUPPLIERS','ECONOMICS','ROMANIA_GAP','OPPORTUNITY_ENGINE','ACADEMY'])assert.equal(hasFeature('DISCOVER',feature),false,feature);
});

test('RADAR inherits Discover and adds Romania Gap and opportunity intelligence',()=>{
  for(const feature of ['TRENDING','RISING','HISTORY','ALERTS','ROMANIA_GAP','OPPORTUNITY_ENGINE','WATCHLIST'])assert.equal(hasFeature('RADAR',feature),true,feature);
  for(const feature of ['SUPPLIERS','ECONOMICS'])assert.equal(hasFeature('RADAR',feature),false,feature);
  assert.equal(hasFeature('RADAR','ACADEMY'),false);
});

test('LAUNCH inherits all intelligence and adds suppliers, economics and execution',()=>{
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
  assert.match(client,/Rising \/ trenduri \/ alerte globale/);
  assert.match(client,/Brand gate \+ importability/);
  assert.match(publicPricing,/Vezi topurile gratuite/);
  assert.match(html,/Checkout-ul și abonamentele reale sunt oprite/);
  assert.doesNotMatch(client,/startSubscriptionCheckout/);
});

test('commercial blueprint V2 documents the same product sequence',()=>{
  const md=fs.readFileSync(new URL('../COMMERCIAL_BLUEPRINT.md',import.meta.url),'utf8');
  assert.match(md,/FREE — What documented products can I explore\?/);
  assert.match(md,/DISCOVER — What is starting to move globally\?/);
  assert.match(md,/RADAR — Which signals survive Romania Gap/);
  assert.match(md,/LAUNCH — Do sourcing and economics support execution\?/);
  assert.match(md,/100,000\+ canonical products/);
  assert.match(md,/100 products × minimum 3 supplier observations = 300 structured supplier offers/);
});
