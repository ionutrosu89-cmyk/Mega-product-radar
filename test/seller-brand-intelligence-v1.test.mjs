import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSellerBrandGraph,rankMarketEntities,categoryConcentration,sellerBrandSummary} from '../seller-brand-intelligence.js';

const rows=[
  {productKey:'p1',seller:'Seller A',brand:'Brand X',estimatedRevenue:1000,estimatedUnits:100,reviews:20,sourceConfidence:90},
  {productKey:'p2',seller:'Seller A',brand:'Brand Y',estimatedRevenue:500,estimatedUnits:50,reviews:10,sourceConfidence:80},
  {productKey:'p3',seller:'Seller B',brand:'Brand X',estimatedRevenue:500,estimatedUnits:40,reviews:5,sourceConfidence:70}
];

test('seller-brand graph separates seller and brand entities',()=>{
  const graph=buildSellerBrandGraph(rows);
  assert.equal(graph.sellers.length,2);
  assert.equal(graph.brands.length,2);
  assert.equal(graph.edges.filter(x=>x.type==='SELLS').length,3);
  assert.equal(graph.edges.filter(x=>x.type==='BRANDS').length,3);
});

test('top seller ranking aggregates product-level estimates without calling them verified',()=>{
  const top=rankMarketEntities(rows,{type:'SELLER'});
  assert.equal(top[0].key,'Seller A');
  assert.equal(top[0].estimatedRevenue,1500);
  assert.equal(top[0].metricBasis,'ESTIMATED_REVENUE');
});

test('category concentration uses estimated revenue when coverage exists',()=>{
  const c=categoryConcentration(rows);
  assert.equal(c.basis,'ESTIMATED_REVENUE');
  assert.equal(c.sellerCount,2);
  assert.match(c.evidencePolicy,/not verified seller revenue/i);
});

test('category concentration falls back to product share when revenue is unknown',()=>{
  const c=categoryConcentration(rows.map(({estimatedRevenue,...r})=>r));
  assert.equal(c.basis,'PRODUCT_COUNT');
  assert.match(c.evidencePolicy,/coverage is insufficient/i);
});

test('summary is market intelligence only and never purchase authorization',()=>{
  const summary=sellerBrandSummary(rows);
  assert.equal(summary.purchaseAuthorized,false);
  assert.equal(summary.topSellers.length,2);
  assert.equal(summary.topBrands.length,2);
});

test('seller-brand schema remains distinct from supplier sourcing and browser writes are revoked',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260824_seller_brand_intelligence_v1.sql',import.meta.url),'utf8');
  assert.match(sql,/marketplace_sellers/i);
  assert.match(sql,/market_brands/i);
  assert.doesNotMatch(sql,/references public\.suppliers/i);
  assert.match(sql,/revoke insert, update, delete on public\.category_entity_snapshots from anon, authenticated/i);
});
