import assert from 'node:assert/strict';
import test from 'node:test';
import {selectGenericOpportunities} from '../top25-generic-selection-v1.js';

const review={decision:'GENERIC_PRIVATE_LABEL',reviewer:'Analyst',reviewedAt:'2026-09-23',evidenceUrl:'https://example.com/brand-review'};
test('brand filtering keeps the source rank and does not invent 25 opportunities',()=>{
  const result=selectGenericOpportunities([
    {externalId:'a',sourceRank:1,name:'Bosch tool'},
    {externalId:'b',sourceRank:2,name:'Foldable stand',brand:'Unfamiliar'},
    {externalId:'c',sourceRank:3,name:'Generic organizer',brandPolicyClass:'GENERIC_PRIVATE_LABEL'}
  ],{b:review,c:review});
  assert.equal(result.ok,false);
  assert.equal(result.code,'INSUFFICIENT_REVIEWED_GENERIC_CANDIDATES');
  assert.equal(result.excludedCount,1);
  assert.deepEqual(result.selected.map(row=>[row.sourceRank,row.opportunityRank]),[[2,1],[3,2]]);
});

test('unknown brands need an independent review, even if feed claims generic',()=>{
  const result=selectGenericOpportunities([{externalId:'x',rank:1,name:'Organizer',brandPolicyClass:'GENERIC_PRIVATE_LABEL'}],{});
  assert.equal(result.selectedCount,0);
  assert.equal(result.pendingCount,1);
});

test('fills a brand-filtered opportunity list from a larger ranked candidate pool',()=>{
  const candidates=Array.from({length:30},(_,index)=>({externalId:`p${index}`,sourceRank:index+1,name:index===0?'Nike shoes':`Organizer ${index}`}));
  const reviews=Object.fromEntries(candidates.map(row=>[row.externalId,review]));
  const result=selectGenericOpportunities(candidates,reviews);
  assert.equal(result.ok,true);
  assert.equal(result.selectedCount,25);
  assert.equal(result.selected[0].sourceRank,2);
  assert.equal(result.selected[24].opportunityRank,25);
  assert.equal(result.selected[24].sourceRank,26);
});
