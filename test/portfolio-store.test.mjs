import assert from 'node:assert/strict';
import test from 'node:test';
import {dedupePortfolio,upsertPortfolio,removePortfolio} from '../portfolio-store.js';

test('dedupe keeps the newest record for the same product name',()=>{
  const rows=[
    {name:'TEST CLOUD',stock:0,updatedAt:'2026-08-13T10:07:44.561Z'},
    {name:'test cloud',stock:5,updatedAt:'2026-08-13T10:08:00.215Z'}
  ];
  const clean=dedupePortfolio(rows);
  assert.equal(clean.length,1);
  assert.equal(clean[0].stock,5);
});

test('upsert updates an existing product instead of adding a duplicate',()=>{
  const rows=[{name:'Produs A',stock:2,updatedAt:'2026-08-13T09:00:00Z'}];
  const next=upsertPortfolio(rows,{name:' produs a ',stock:7,updatedAt:'2026-08-13T10:00:00Z'});
  assert.equal(next.length,1);
  assert.equal(next[0].stock,7);
});

test('remove deletes the product by normalized name',()=>{
  const rows=[{name:'Cana Copii',stock:3},{name:'Alt Produs',stock:1}];
  const next=removePortfolio(rows,'cana copii');
  assert.deepEqual(next.map(x=>x.name),['Alt Produs']);
});
