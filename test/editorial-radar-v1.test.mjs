import assert from 'node:assert/strict';
import test from 'node:test';
import {buildEditorialRadarFeed,freshEditorialProducts,normalizeEditorialCandidate,normalizeEditorialEvidence} from '../editorial-radar-v1.js';
import {freeProductKey,readFreeShortlist,toggleFreeShortlist} from '../free-shortlist.js';

const now=new Date('2026-09-27T12:00:00Z');
const candidate={
  id:'BO-06',nicheId:'BIROU_ORGANIZARE',title:'Suport vertical A4 cu cinci compartimente',
  need:'Separarea documentelor pe birou.',rationale:'Concept generic de verificat pentru organizarea documentelor.',
  brandReview:{status:'GENERIC_CONCEPT_REVIEWED',reviewer:'Reviewer MPR',reviewedAt:'2026-09-26T10:00:00Z'},
  publication:{status:'APPROVED_RESEARCH',reviewer:'Reviewer MPR',reviewedAt:'2026-09-26T11:00:00Z',rightsBasis:'ORIGINAL_MPR_SUMMARY_AND_LINKS'},
  evidence:[{type:'IDENTITY',sourceName:'Office Direct',sourceUrl:'https://www.officedirect.ro/accesorii-pentru-birou/',observedAt:'2026-09-26T09:00:00Z',retrievedAt:'2026-09-26T10:00:00Z',summary:'A fost observată o listare pentru un concept analog de suport vertical.',usage:'LINK_WITH_ORIGINAL_SUMMARY',verification:'OBSERVED'}]
};
const input=products=>({schema:'MPR_EDITORIAL_CANDIDATES_V1',products});

test('selection accepts one reviewed research concept without fabricating a source rank or commercial verdict',()=>{
  const feed=buildEditorialRadarFeed(input([candidate]),{now});
  assert.equal(feed.products.length,1);
  assert.equal(feed.products[0].sourceRank,null);
  assert.equal(feed.products[0].stage,'DISCOVERED');
  assert.equal(feed.products[0].missingEvidence.includes('SUPPLIER'),true);
  assert.equal(feed.niches.find(niche=>niche.id==='BIROU_ORGANIZARE').documentedCount,1);
  assert.equal(feed.niches.length,25);
});

test('drafts never enter public feed; approved records must pass rights, generic and source review',()=>{
  assert.equal(buildEditorialRadarFeed(input([{...candidate,publication:{status:'DRAFT'}}]),{now}).products.length,0);
  assert.equal(normalizeEditorialCandidate({...candidate,brandReview:{...candidate.brandReview,status:'UNKNOWN'}},{now}),null);
  assert.equal(normalizeEditorialCandidate({...candidate,publication:{...candidate.publication,rightsBasis:'UNKNOWN'}},{now}),null);
  assert.throws(()=>buildEditorialRadarFeed(input([{...candidate,evidence:[{...candidate.evidence[0],sourceUrl:'javascript:alert(1)'}]}]),{now}),/EDITORIAL_APPROVED_CANDIDATE_INVALID/);
  assert.throws(()=>buildEditorialRadarFeed(input([candidate,candidate]),{now}),/EDITORIAL_DUPLICATE_ID/);
});

test('expired market evidence loses eligibility and expired identity removes the card',()=>{
  const ro={...candidate.evidence[0],type:'RO_COMPARABLE',sourceUrl:'https://example.com/ro',observedAt:'2026-09-26T09:00:00Z',retrievedAt:'2026-09-26T10:00:00Z'};
  const feed=buildEditorialRadarFeed(input([{...candidate,evidence:[...candidate.evidence,ro]}]),{now});
  const later=new Date('2026-10-05T12:00:00Z');
  const visible=freshEditorialProducts(feed,{now:later});
  assert.equal(visible.length,1);
  assert.equal(visible[0].evidence.some(item=>item.type==='RO_COMPARABLE'),false);
  assert.equal(visible[0].expiredEvidenceCount,1);
  assert.equal(freshEditorialProducts(feed,{now:new Date('2026-10-28T12:00:00Z')}).length,0);
});

test('repeated observations from the same source expose the newest reviewed snapshot',()=>{
  const newer={...candidate.evidence[0],observedAt:'2026-09-27T08:00:00Z',retrievedAt:'2026-09-27T09:00:00Z',summary:'Revizie mai nouă a listării, fără estimări de vânzări.'};
  const feed=buildEditorialRadarFeed(input([{...candidate,evidence:[candidate.evidence[0],newer]}]),{now});
  assert.equal(feed.products[0].evidence.length,1);
  assert.equal(feed.products[0].evidence[0].summary,newer.summary);
});

test('niche search context cannot be laundered into product-specific demand',()=>{
  const demand={...candidate.evidence[0],type:'DEMAND',sourceUrl:'https://trends.google.com/trends/explore?geo=RO&q=suport%20A4',demandScope:'NICHE_CONTEXT'};
  assert.equal(normalizeEditorialEvidence(demand,{now}),null);
  const specific=normalizeEditorialEvidence({...demand,demandScope:'PRODUCT_SPECIFIC'},{now});
  assert.equal(specific.demandScope,'PRODUCT_SPECIFIC');
});

test('stable editorial key survives reload and keeps account scopes distinct',()=>{
  const memory=new Map(),storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
  const key=freeProductKey({externalId:candidate.id},'MPR_EDITORIAL');
  assert.equal(key,'MPR_EDITORIAL:BO-06');
  const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
  assert.equal(toggleFreeShortlist(new Set(),key,storage,first).changed,true);
  assert.equal(readFreeShortlist(storage,first).has(key),true);
  assert.equal(readFreeShortlist(storage,second).has(key),false);
});
