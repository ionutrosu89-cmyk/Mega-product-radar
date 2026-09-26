import assert from 'node:assert/strict';
import test from 'node:test';
import {selectGenericOpportunities} from '../top25-generic-selection-v1.js';

const nicheId='BIROU_ORGANIZARE';
const review={decision:'GENERIC_PRIVATE_LABEL',reviewer:'Analyst',reviewedAt:'2026-09-23',evidenceUrl:'https://example.com/brand-review',nicheId,nicheDecision:'IN_SCOPE',nicheEvidenceUrl:'https://example.com/niche-review'};
test('brand filtering keeps the source rank and does not invent 25 opportunities',()=>{
  const result=selectGenericOpportunities([
    {externalId:'a',sourceRank:1,name:'Bosch tool',nicheId},
    {externalId:'b',sourceRank:2,name:'Foldable stand',brand:'Unfamiliar',nicheId},
    {externalId:'c',sourceRank:3,name:'Generic organizer',brandPolicyClass:'GENERIC_PRIVATE_LABEL',nicheId}
  ],{b:{...review,conceptKey:'STAND_FOLDABLE'},c:{...review,conceptKey:'DESK_ORGANIZER'}},{nicheId});
  assert.equal(result.ok,false);
  assert.equal(result.code,'INSUFFICIENT_REVIEWED_GENERIC_CANDIDATES');
  assert.equal(result.excludedCount,1);
  assert.deepEqual(result.selected.map(row=>[row.sourceRank,row.opportunityRank]),[[2,1],[3,2]]);
});

test('unknown brands need an independent review, even if feed claims generic',()=>{
  const result=selectGenericOpportunities([{externalId:'x',rank:1,name:'Organizer',brandPolicyClass:'GENERIC_PRIVATE_LABEL',nicheId}],{},{nicheId});
  assert.equal(result.selectedCount,0);
  assert.equal(result.pendingCount,1);
});

test('fills a brand-filtered opportunity list from a larger ranked candidate pool',()=>{
  const candidates=Array.from({length:30},(_,index)=>({externalId:`p${index}`,sourceRank:index+1,name:index===0?'Nike shoes':`Organizer ${index}`,nicheId}));
  const reviews=Object.fromEntries(candidates.map(row=>[row.externalId,{...review,conceptKey:row.externalId}]));
  const result=selectGenericOpportunities(candidates,reviews,{nicheId});
  assert.equal(result.ok,true);
  assert.equal(result.selectedCount,25);
  assert.equal(result.selected[0].sourceRank,2);
  assert.equal(result.selected[24].opportunityRank,25);
  assert.equal(result.selected[24].sourceRank,26);
});

test('brand approval alone cannot fill a niche or count variants twice',()=>{
  const candidates=[
    {externalId:'a',sourceRank:1,name:'Desk tray 13 pieces',nicheId},
    {externalId:'b',sourceRank:2,name:'Desk tray 13 pieces other color',nicheId},
    {externalId:'c',sourceRank:3,name:'Cable clips',nicheId},
    {externalId:'d',sourceRank:4,name:'Makeup case',nicheId:'BEAUTY'}
  ];
  const reviews={
    a:{...review,conceptKey:'TRAY_13'},
    b:{...review,conceptKey:'TRAY_13'},
    c:{...review,conceptKey:'CABLE_CLIPS',nicheDecision:'PENDING'},
    d:{...review,conceptKey:'MAKEUP_CASE'}
  };
  const result=selectGenericOpportunities(candidates,reviews,{nicheId,targetCount:2});
  assert.equal(result.ok,false);
  assert.equal(result.selectedCount,1);
  assert.equal(result.pending.find(row=>row.externalId==='c')?.reason,'NICHE_REVIEW_REQUIRED');
  assert.equal(result.excluded.find(row=>row.externalId==='b')?.reason,'DUPLICATE_REVIEWED_CONCEPT');
  assert.equal(result.excluded.find(row=>row.externalId==='d')?.reason,'WRONG_NICHE');
});
