import assert from 'node:assert/strict';
import test from 'node:test';
import {FREE_TOP25_EXPANDED_REGISTRY} from '../free-top25-expanded-registry.js';
import {loadExpandedTop25Niches} from '../netlify/functions/free-top25.mjs';

function asinFor(nicheIndex,productIndex){
  return `T${String(nicheIndex).padStart(3,'0')}${String(productIndex).padStart(6,'0')}`;
}
function eligibleProducts(nicheIndex){
  return Array.from({length:25},(_,index)=>({
    asin:asinFor(nicheIndex,index+1),
    name:`Generic utility product ${nicheIndex}-${index+1}`,
    sourceKey:'KAGGLE_AMAZON_PRODUCTS_2023',
    metric:{label:'Recenzii istorice observate',value:1000-index,unit:'reviews_historical'}
  }));
}
function invalidProducts(){
  return Array.from({length:25},(_,index)=>({
    key:`unverified-${index+1}`,
    name:`Unverified product ${index+1}`,
    sourceKey:'AMAZON_IDEAS'
  }));
}

test('public Free Top25 selects newest eligible 25/25 snapshot instead of newest unverified snapshot',async()=>{
  const rows=[];
  FREE_TOP25_EXPANDED_REGISTRY.forEach((niche,nicheIndex)=>{
    rows.push({niche_id:niche.id,reviewed_at:'2026-09-04',products:invalidProducts()});
    rows.push({niche_id:niche.id,reviewed_at:'2026-09-02',products:eligibleProducts(nicheIndex+1)});
  });
  const fetchImpl=async()=>Response.json(rows);
  const niches=await loadExpandedTop25Niches({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key'},
    fetchImpl
  });
  assert.equal(niches.length,25);
  assert.equal(niches.reduce((sum,niche)=>sum+niche.products.length,0),625);
  for(const niche of niches){
    assert.equal(niche.reviewedAt,'2026-09-02');
    assert.equal(niche.products.length,25);
    assert.equal(new Set(niche.products.map(product=>product.asin)).size,25);
    for(const product of niche.products){
      assert.equal(product.sourceKey,'KAGGLE_AMAZON_PRODUCTS_2023');
      assert.equal(product.evidenceClass,'DERIVED');
      assert.equal(product.sourcePeriod,'snapshot Sep 2023');
      assert.match(product.sourceUrl,/^https:\/\/www\.kaggle\.com\//);
    }
  }
});

test('public Free Top25 rejects a niche when no complete eligible snapshot exists',async()=>{
  const rows=FREE_TOP25_EXPANDED_REGISTRY.map(niche=>({niche_id:niche.id,reviewed_at:'2026-09-04',products:invalidProducts()}));
  const fetchImpl=async()=>Response.json(rows);
  const niches=await loadExpandedTop25Niches({
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key'},
    fetchImpl
  });
  assert.equal(niches.length,0);
});
