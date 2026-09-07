import assert from 'node:assert/strict';
import test from 'node:test';
import {loadCurrentTop25Coverage} from '../netlify/functions/free-top25.mjs';

const now=new Date('2026-09-07T18:00:00Z');
const products=Array.from({length:25},(_,index)=>({
  name:index===0?'Nike storage organizer':`Generic storage organizer ${index+1}`,
  externalId:`E${String(index+1).padStart(4,'0')}`,
  rank:index+1,
  observedAt:'2026-09-07T12:00:00Z',
  sourceUrl:`https://example.com/p/${index+1}`,
  sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',
  sourceLabel:'eBay Buy Marketing API · BEST_SELLING',
  evidenceClass:'DERIVED',
  salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES',
  rankingBasis:'WINDOW_PERSISTENCE_FROM_DIRECT_PLATFORM_RANK'
}));

test('current 7D loader keeps real partial niche coverage and applies commercial brand gate',async()=>{
  const rows=[{niche_id:'CASA',platform:'EBAY',market:'EBAY_US',window_days:7,window_end:'2026-09-07T17:59:59Z',products,product_count:25,evidence_class:'DERIVED',source_key:'EBAY_BUY_MARKETING_BEST_SELLING',source_label:'eBay Buy Marketing API · BEST_SELLING',source_rights_status:'APPROVED_OFFICIAL_API',freshness_status:'CURRENT'}];
  const coverage=await loadCurrentTop25Coverage({
    windowDays:7,now,
    env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only'},
    fetchImpl:async()=>Response.json(rows)
  });
  assert.equal(coverage.niches.length,25);
  assert.equal(coverage.totalPositions,25);
  assert.equal(coverage.requiredPositions,625);
  const casa=coverage.niches.find(niche=>niche.id==='CASA');
  assert.equal(casa.productCount,25);
  assert.equal(casa.commercialEligibleCount,24);
  assert.equal(casa.products[0].brandPolicyClass,'ESTABLISHED_EXCLUDE');
  assert.equal(casa.products[0].commercialEligible,false);
  const auto=coverage.niches.find(niche=>niche.id==='AUTO');
  assert.equal(auto.productCount,0);
  assert.equal(auto.coverage,'0/25');
  assert.equal(coverage.complete,false);
});

test('current loader rejects rights-held rows instead of falling back to archive',async()=>{
  const rows=[{niche_id:'CASA',platform:'AMAZON_US',market:'AMAZON_US',window_days:7,window_end:'2026-09-07T17:59:59Z',products,product_count:25,evidence_class:'DERIVED',source_key:'AMAZON_PUBLIC_PAGE',source_label:'Amazon public page',source_rights_status:'RIGHTS_HOLD',freshness_status:'CURRENT'}];
  const coverage=await loadCurrentTop25Coverage({windowDays:7,now,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only'},fetchImpl:async()=>Response.json(rows)});
  assert.equal(coverage.totalPositions,0);
  assert.equal(coverage.niches.every(niche=>niche.productCount===0),true);
  assert.equal(coverage.complete,false);
});
