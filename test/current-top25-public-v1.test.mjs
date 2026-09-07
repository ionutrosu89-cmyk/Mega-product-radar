import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCurrentTop25PublicCoverage,sanitizeCurrentTop25Snapshot} from '../current-top25-public-v1.js';

const now=new Date('2026-09-07T18:00:00Z');
const products=count=>Array.from({length:count},(_,index)=>({name:`P${index+1}`,externalId:`E${String(index+1).padStart(4,'0')}`,sourceUrl:`https://example.com/p/${index+1}`,observedAt:'2026-09-07T12:00:00Z',evidenceClass:'DIRECT'}));
const row=(overrides={})=>({niche_id:'CASA',platform:'EBAY',market:'EBAY_US',window_days:7,window_end:'2026-09-07T17:59:59Z',products:products(25),product_count:25,evidence_class:'DERIVED',source_key:'EBAY_BUY_MARKETING_BEST_SELLING',source_label:'eBay Buy Marketing API',source_rights_status:'APPROVED_OFFICIAL_API',freshness_status:'CURRENT',...overrides});

test('approved current 25/25 snapshot passes',()=>{
  const value=sanitizeCurrentTop25Snapshot(row(),{now});
  assert.equal(value.complete,true);
  assert.equal(value.productCount,25);
  assert.equal(value.coverage,'25/25');
  assert.equal(value.sourceRightsStatus,'APPROVED_OFFICIAL_API');
});

test('rights hold never enters public current Top25',()=>{
  assert.equal(sanitizeCurrentTop25Snapshot(row({source_rights_status:'RIGHTS_HOLD'}),{now}),null);
});

test('stale snapshot is rejected instead of falling back to historical data',()=>{
  assert.equal(sanitizeCurrentTop25Snapshot(row({window_end:'2026-09-05T12:00:00Z'}),{now}),null);
});

test('product outside selected window rejects whole snapshot',()=>{
  const stale=products(25);stale[3].observedAt='2026-08-25T00:00:00Z';
  assert.equal(sanitizeCurrentTop25Snapshot(row({products:stale}),{now}),null);
});

test('partial coverage is preserved as INSUFFICIENT_DATA and not padded',()=>{
  const partial=row({niche_id:'AUTO',products:products(18),product_count:18,evidence_class:'INSUFFICIENT_DATA',freshness_status:'INSUFFICIENT_DATA'});
  const coverage=buildCurrentTop25PublicCoverage([partial],{windowDays:7,now,requiredNiches:['AUTO','CASA']});
  assert.equal(coverage.totalPositions,18);
  assert.equal(coverage.requiredPositions,50);
  assert.equal(coverage.niches[0].coverage,'18/25');
  assert.equal(coverage.niches[0].evidenceClass,'INSUFFICIENT_DATA');
  assert.equal(coverage.niches[1].coverage,'0/25');
  assert.equal(coverage.complete,false);
  assert.equal(coverage.policy.historicalFallback,false);
});
