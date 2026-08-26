import assert from 'node:assert/strict';
import test from 'node:test';
import {dedupePortfolio,upsertPortfolio,removePortfolio,portfolioDecisionRows} from '../portfolio-store.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('dedupe keeps newest record for the same canonical product id across title changes',()=>{
  const rows=[
    {canonicalProductId:A,name:'Titlu vechi',stock:0,updatedAt:'2026-08-13T10:07:44.561Z'},
    {canonicalProductId:A,name:'Titlu nou',stock:5,updatedAt:'2026-08-13T10:08:00.215Z'}
  ];
  const clean=dedupePortfolio(rows);
  assert.equal(clean.length,1);
  assert.equal(clean[0].stock,5);
  assert.equal(clean[0].name,'Titlu nou');
  assert.equal(clean[0].decisionEligible,true);
});

test('upsert updates by canonical id and never infers identity from product title',()=>{
  const rows=[{canonicalProductId:A,name:'Produs A',stock:2,updatedAt:'2026-08-13T09:00:00Z'}];
  const next=upsertPortfolio(rows,{canonicalProductId:A,name:'Alt titlu',stock:7,updatedAt:'2026-08-13T10:00:00Z'});
  assert.equal(next.length,1);
  assert.equal(next[0].stock,7);
  const blocked=upsertPortfolio(next,{name:'Alt titlu',stock:99,updatedAt:'2026-08-13T11:00:00Z'});
  assert.equal(blocked.length,1);
  assert.equal(blocked[0].stock,7);
});

test('legacy title records stay readable but canonical record wins on title collision',()=>{
  const clean=dedupePortfolio([{name:'Produs A',stock:99},{canonicalProductId:A,name:'Produs A',stock:5},{name:'Produs B',stock:3}]);
  assert.equal(clean.length,2);
  assert.equal(clean.find(x=>x.name==='Produs A').canonicalProductId,A);
  assert.equal(clean.find(x=>x.name==='Produs B').decisionEligible,false);
  assert.deepEqual(portfolioDecisionRows(clean).map(x=>x.canonicalProductId),[A]);
});

test('same title on two canonical ids remains two distinct portfolio identities',()=>{
  const clean=dedupePortfolio([{canonicalProductId:A,name:'Same',stock:1},{canonicalProductId:B,name:'Same',stock:2}]);
  assert.equal(clean.length,2);
});

test('remove deletes canonical record by UUID while legacy removal remains compatibility-only',()=>{
  const rows=[{canonicalProductId:A,name:'Cana Copii',stock:3},{name:'Alt Produs',stock:1}];
  const next=removePortfolio(rows,A);
  assert.deepEqual(next.map(x=>x.name),['Alt Produs']);
  assert.deepEqual(removePortfolio(next,'alt produs'),[]);
});
