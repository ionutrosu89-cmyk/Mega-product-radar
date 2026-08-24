import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {flattenCategoryUniverse,validateCategoryUniverse,categoryBreadcrumb,categoryCapacityPlan} from '../category-universe-engine.js';

const universe=JSON.parse(fs.readFileSync(new URL('../category-universe-v2.json',import.meta.url),'utf8'));

test('Category Universe V2 is hierarchical and sized for large FREE catalogue',()=>{
  const result=validateCategoryUniverse(universe);
  assert.equal(result.valid,true,result.errors.join('; '));
  assert.ok(result.stats.departmentCount>=10);
  assert.ok(result.stats.categoryCount>=20);
  assert.ok(result.stats.nicheCount>=80);
  assert.ok(universe.targetArchitectureProducts>=100000);
});

test('taxonomy exposes stable department category and niche relationships',()=>{
  const rows=flattenCategoryUniverse(universe);
  const visor=rows.find(r=>r.key==='visor-accessories');
  assert.equal(visor.level,'NICHE');
  assert.equal(visor.parentKey,'car-interior');
  assert.deepEqual(categoryBreadcrumb(universe,'visor-accessories').map(x=>x.key),['automotive','car-interior','visor-accessories']);
});

test('capacity plan targets Top 100 while keeping taxonomy independent of commercial gates',()=>{
  const plan=categoryCapacityPlan(universe);
  assert.equal(plan.targetProducts,100000);
  assert.equal(plan.rankingTop,100);
  assert.ok(plan.averageProductsPerNiche>0);
  assert.equal('commercialAction' in plan,false);
  assert.equal('purchaseAuthorized' in plan,false);
});

test('taxonomy migration is append-safe and browser writes are revoked',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260824_category_universe_v2.sql',import.meta.url),'utf8');
  assert.match(sql,/create table if not exists public\.category_nodes/i);
  assert.match(sql,/product_category_memberships/i);
  assert.match(sql,/category_market_snapshots/i);
  assert.match(sql,/revoke insert, update, delete on public\.category_nodes from anon, authenticated/i);
});
