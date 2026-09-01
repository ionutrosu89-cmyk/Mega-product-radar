import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {buildFreeNicheTop25Plan,flattenFreeNicheTaxonomy} from '../free-niche-top25-engine-v1.js';

const taxonomy=JSON.parse(await readFile(new URL('../category-universe-v2.json',import.meta.url),'utf8'));

function product(i,nicheKey='office:desk-organization'){
  return {
    name:`Desk product ${i}`,
    asin:`ASIN${String(i).padStart(6,'0')}`,
    nicheKey,
    cat:'Birou & Work from Home',
    discoveryAnalysis:{score:100-i},
    signals:{amazonUS:{present:true,evidenceClass:'VERIFIED',label:'Amazon US',links:[{url:`https://www.amazon.com/dp/ASIN${i}`}]}}
  };
}

test('canonical Free plan contains 108 niches and 2700 target slots',()=>{
  const registry=flattenFreeNicheTaxonomy(taxonomy);
  assert.equal(registry.length,108);
  assert.equal(new Set(registry.map(row=>row.nicheKey)).size,108);
  const plan=buildFreeNicheTop25Plan({taxonomy});
  assert.equal(plan.stats.totalNiches,108);
  assert.equal(plan.stats.targetProductSlots,2700);
  assert.equal(plan.stats.remainingProductSlots,2700);
  assert.equal(plan.planStatus,'IN_PROGRESS');
});

test('one niche becomes complete only with exactly 25 eligible unique products',()=>{
  const incomplete=buildFreeNicheTop25Plan({taxonomy,discoveryProducts:Array.from({length:24},(_,i)=>product(i+1))});
  const before=incomplete.niches.find(row=>row.nicheKey==='office:desk-organization');
  assert.equal(before.status,'NEAR_READY');
  assert.equal(before.acceptedProductCount,24);
  assert.deepEqual(before.products,[]);
  const complete=buildFreeNicheTop25Plan({taxonomy,discoveryProducts:Array.from({length:25},(_,i)=>product(i+1))});
  const after=complete.niches.find(row=>row.nicheKey==='office:desk-organization');
  assert.equal(after.status,'COMPLETE');
  assert.equal(after.products.length,25);
  assert.deepEqual(after.products.map(row=>row.rank),Array.from({length:25},(_,i)=>i+1));
});

test('duplicate products do not inflate completion and search is niche scoped',()=>{
  const rows=[...Array.from({length:24},(_,i)=>product(i+1)),product(1)];
  const plan=buildFreeNicheTop25Plan({taxonomy,discoveryProducts:rows},{query:'desk organization'});
  assert.equal(plan.niches.length,1);
  assert.equal(plan.niches[0].acceptedProductCount,24);
  assert.equal(plan.niches[0].status,'NEAR_READY');
});

test('Free response never exposes supplier economics or purchase authority',()=>{
  const rows=Array.from({length:25},(_,i)=>({...product(i+1),supplierUrl:'https://supplier.example',landedCost:4,profit:20,roi:5}));
  const plan=buildFreeNicheTop25Plan({taxonomy,discoveryProducts:rows},{niche:'office:desk-organization'});
  const serialized=JSON.stringify(plan);
  assert.doesNotMatch(serialized,/supplier\.example|landedCost|"profit"|"roi"/);
  assert.equal(plan.truthPolicy.supplierDataExposed,false);
  assert.equal(plan.truthPolicy.economicsExposed,false);
  assert.equal(plan.truthPolicy.purchaseAuthorized,false);
});
