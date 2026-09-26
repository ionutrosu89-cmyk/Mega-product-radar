import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeGenericTop25Snapshot} from '../top25-generic-snapshot-v1.js';
import {normalizeCrossMarketSnapshot,buildFreeCrossMarketExperience} from '../free-cross-market-registry.js';

const now=new Date('2026-09-25T12:00:00Z');
const review=(id)=>({decision:'GENERIC_PRIVATE_LABEL',reviewer:'Pilot reviewer',reviewedAt:'2026-09-25T09:00:00Z',evidenceUrl:`https://evidence.example/brand/${id}`,nicheId:'BIROU_ORGANIZARE',nicheDecision:'IN_SCOPE',nicheEvidenceUrl:`https://evidence.example/niche/${id}`,conceptKey:`DESK_CONCEPT_${id}`});
const input=()=>{
  const candidates=Array.from({length:26},(_,index)=>({externalId:`item-${index+1}`,sourceRank:index+1,name:index===0?'Nike branded organizer':`Desk organizer ${index+1}`,nicheId:'BIROU_ORGANIZARE',sourceUrl:`https://www.ebay.com/itm/${index+1}`,observedAt:'2026-09-25T10:00:00Z'}));
  return {nicheId:'BIROU_ORGANIZARE',platform:'MPR_GENERIC',sourcePlatform:'EBAY',market:'EBAY_US',sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',sourceLabel:'eBay Buy Marketing API',candidates,reviews:Object.fromEntries(candidates.map(row=>[row.externalId,review(row.externalId)]))};
};

test('curated Top 25 excludes established brands and preserves the original source ranks',()=>{
  const raw=input();
  const result=normalizeGenericTop25Snapshot(raw,raw.reviews,{now,rightsApproved:true});
  assert.equal(result.ok,true);
  assert.equal(result.snapshot.products.length,25);
  assert.deepEqual(result.snapshot.products[0].rank,1);
  assert.deepEqual(result.snapshot.products[0].sourceRank,2);
  assert.deepEqual(result.snapshot.products.at(-1).sourceRank,26);
  const normalized=normalizeCrossMarketSnapshot(result.snapshot,{now});
  assert.equal(normalized?.products.length,25);
  assert.equal(normalized.products[0].sourceRank,2);
  const view=buildFreeCrossMarketExperience({snapshots:[result.snapshot],now});
  assert.equal(view.coverage.curatedPositions,25);
  assert.equal(view.coverage.livePositions,0);
  assert.equal(view.coverage.consensusReady,false);
});

test('curated publication requires source-specific rights, 25 reviews and recent source observations',()=>{
  const raw=input();
  assert.equal(normalizeGenericTop25Snapshot(raw,raw.reviews,{now,rightsApproved:false}).code,'PUBLIC_DISPLAY_RIGHTS_REQUIRED');
  const incomplete={...raw,reviews:{...raw.reviews}};
  delete incomplete.reviews['item-26'];
  assert.equal(normalizeGenericTop25Snapshot(incomplete,incomplete.reviews,{now,rightsApproved:true}).code,'INSUFFICIENT_REVIEWED_GENERIC_CANDIDATES');
  const stale={...raw,candidates:raw.candidates.map(row=>({...row,observedAt:'2026-09-20T10:00:00Z'}))};
  assert.equal(normalizeGenericTop25Snapshot(stale,stale.reviews,{now,rightsApproved:true}).code,'STALE_CURATED_PRODUCT');
});

test('curated read path rejects missing human evidence and duplicate concepts',()=>{
  const raw=input(),snapshot=normalizeGenericTop25Snapshot(raw,raw.reviews,{now,rightsApproved:true}).snapshot;
  assert.equal(normalizeCrossMarketSnapshot({...snapshot,products:snapshot.products.map((row,index)=>index===0?{...row,brandReview:null}:row)},{now}),null);
  assert.equal(normalizeCrossMarketSnapshot({...snapshot,products:snapshot.products.map((row,index)=>index===1?{...row,conceptKey:snapshot.products[0].conceptKey}:row)},{now}),null);
});
