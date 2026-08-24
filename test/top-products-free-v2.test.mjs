import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildTopProducts,topProductsSummary,MARKET_SCORE_WEIGHTS} from '../top-products-engine-v2.js';

const rows=[
  {productKey:'p1',title:'A',nicheKey:'desk-organization',marketplace:'amazon-us',estimatedUnits:1000,estimatedRevenue:50000,reviews:500,sourceRank:1,reviewGrowth30d:40,sourceConfidence:90,salesEvidenceClass:'ESTIMATED',url:'https://example.com/a'},
  {productKey:'p2',title:'B',nicheKey:'desk-organization',marketplace:'amazon-us',estimatedUnits:800,estimatedRevenue:40000,reviews:350,sourceRank:4,reviewGrowth30d:20,sourceConfidence:80,salesEvidenceClass:'ESTIMATED',url:'https://example.com/b'},
  {productKey:'p3',title:'C',nicheKey:'desk-organization',marketplace:'amazon-us',estimatedUnits:null,estimatedRevenue:null,reviews:900,sourceRank:2,reviewGrowth30d:null,sourceConfidence:50,salesEvidenceClass:'UNKNOWN'}
];

test('Market Score V2 weights sum to 100',()=>{
  assert.equal(Object.values(MARKET_SCORE_WEIGHTS).reduce((a,b)=>a+b,0),100);
});

test('FREE Top Products can return up to Top 100 per niche',()=>{
  const many=Array.from({length:140},(_,i)=>({productKey:`x${i}`,title:`P${i}`,nicheKey:'phone-holders',sourceRank:i+1,reviews:140-i,sourceConfidence:80,salesEvidenceClass:'UNKNOWN'}));
  assert.equal(buildTopProducts(many,{nicheKey:'phone-holders',limit:100}).length,100);
});

test('sparse evidence is penalized instead of being rewarded by missing metrics',()=>{
  const ranking=buildTopProducts(rows,{nicheKey:'desk-organization'});
  const rich=ranking.find(r=>r.productKey==='p1');
  const sparse=ranking.find(r=>r.productKey==='p3');
  assert.ok(rich.metricCoveragePct>sparse.metricCoveragePct);
  assert.ok(rich.marketScore>sparse.marketScore);
});

test('MPR ranking never upgrades ESTIMATED sales to VERIFIED',()=>{
  const summary=topProductsSummary(rows,{nicheKey:'desk-organization'});
  assert.equal(summary.verifiedSales,0);
  assert.equal(summary.estimatedSales,2);
  assert.match(summary.policy,/never presented as verified sales/i);
});

test('direct source link exists only for explicit https URL',()=>{
  const ranking=buildTopProducts(rows,{nicheKey:'desk-organization'});
  assert.match(ranking.find(r=>r.productKey==='p1').directSourceUrl,/^https:/);
  assert.equal(ranking.find(r=>r.productKey==='p3').directSourceUrl,null);
});

test('Top Products ranking history is public read-only and capped at rank 100',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260824_top_products_free_v2.sql',import.meta.url),'utf8');
  assert.match(sql,/mpr_rank > 0 and mpr_rank <= 100/i);
  assert.match(sql,/category_top_product_snapshots_public_read/i);
  assert.match(sql,/revoke insert, update, delete on public\.category_top_product_snapshots from anon, authenticated/i);
});
