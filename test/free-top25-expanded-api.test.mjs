import assert from 'node:assert/strict';
import test from 'node:test';
import {FREE_TOP25_EXPANDED_REGISTRY} from '../free-top25-expanded-registry.js';
import {loadExpandedTop25Niches} from '../netlify/functions/free-top25.mjs';

function product(index,overrides={}){
  return {
    name:`Dataset product ${index}`,
    asin:`B${String(index).padStart(9,'0')}`,
    sourceKey:'KAGGLE_AMAZON_PRODUCTS_2023',
    sourceUrl:'https://www.kaggle.com/datasets/example/source',
    sourceTier:'A',
    sourceKind:'UNTRUSTED_INPUT',
    sourcePeriod:'wrong',
    sourceRank:index,
    supplierCost:1,
    margin:99,
    purchaseAuthorized:true,
    ...overrides
  };
}

test('expanded Free plan exposes only complete 25-product niches and hardens their evidence semantics',async()=>{
  const rows=FREE_TOP25_EXPANDED_REGISTRY.map((niche,index)=>({
    niche_id:niche.id,
    reviewed_at:index===0?'2026-09-01':'2026-09-02',
    products:Array.from({length:niche.id==='GRADINA_BALCON'?24:25},(_,i)=>product(i+1))
  }));
  rows.push({niche_id:'ORGANIZARE_CASA',reviewed_at:'2026-09-02',products:Array.from({length:25},(_,i)=>product(i+1))});
  const fetchImpl=async()=>Response.json(rows);
  const niches=await loadExpandedTop25Niches({env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-secret'},fetchImpl});

  assert.equal(FREE_TOP25_EXPANDED_REGISTRY.length,25);
  assert.equal(niches.length,24);
  assert.ok(!niches.some(niche=>niche.id==='GRADINA_BALCON'));
  assert.equal(niches.find(niche=>niche.id==='ORGANIZARE_CASA').reviewedAt,'2026-09-02');
  for(const niche of niches){
    assert.equal(niche.mode,'LICENSED_HISTORICAL_EVIDENCE');
    assert.equal(niche.products.length,25);
    for(const [index,row] of niche.products.entries()){
      assert.equal(row.rank,index+1);
      assert.equal(row.sourceTier,'B');
      assert.equal(row.sourceKind,'HISTORICAL_DATASET');
      assert.equal(row.sourceRank,null);
      assert.equal(row.internalRankClass,'DERIVED');
      assert.equal(row.commercialGate,'BRAND_REVIEW_REQUIRED');
      assert.equal(row.brandPolicyClass,'UNKNOWN_REVIEW');
      assert.equal(row.commercialEligible,true);
      assert.equal('supplierCost' in row,false);
      assert.equal('margin' in row,false);
      assert.equal('purchaseAuthorized' in row,false);
    }
  }
});

test('expanded Free API marks established-brand rows as stopped before the public commercial funnel',async()=>{
  const rows=FREE_TOP25_EXPANDED_REGISTRY.map(niche=>({
    niche_id:niche.id,reviewed_at:'2026-09-03',
    products:Array.from({length:25},(_,i)=>product(i+1,i===0?{name:'Rubbermaid organizer'}:{}))
  }));
  const niches=await loadExpandedTop25Niches({env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-secret'},fetchImpl:async()=>Response.json(rows)});
  for(const niche of niches){
    assert.equal(niche.products[0].commercialGate,'STOP_BRAND_GATE');
    assert.equal(niche.products[0].commercialEligible,false);
  }
});

test('expanded Free plan fails closed without server credentials',async()=>{
  let called=false;
  const niches=await loadExpandedTop25Niches({env:{},fetchImpl:async()=>{called=true;return Response.json([]);}});
  assert.deepEqual(niches,[]);
  assert.equal(called,false);
});
