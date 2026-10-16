import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyPublicBrandGate,publicCommerciallyEligible} from '../brand-policy-v1.js';

test('public brand gate blocks reviewed established brands',()=>{
  for(const name of ['Rubbermaid drawer organizer','AmazonBasics desk organizer','SteelSeries mouse pad','Park Tool bicycle hook']){
    const result=classifyPublicBrandGate({name});
    assert.equal(result.brandPolicyClass,'ESTABLISHED_EXCLUDE',name);
    assert.equal(result.commercialEligible,false,name);
  }
});

test('an unclassified brand never becomes publicly eligible by absence from the denylist',()=>{
  const generic=classifyPublicBrandGate({name:'Foldable under-sink organizer'});
  assert.equal(generic.brandPolicyClass,'UNKNOWN_REVIEW');
  assert.equal(generic.commercialEligible,false);
  assert.equal(publicCommerciallyEligible({name:'Foldable under-sink organizer'}),false);
});

test('researched established pilot brands are excluded',()=>{
  for(const name of ['Sterilite Storage Boxes','TESSAN European Travel Plug Adapter']){
    const result=classifyPublicBrandGate({name});
    assert.equal(result.brandPolicyClass,'ESTABLISHED_EXCLUDE');
    assert.equal(result.commercialEligible,false);
  }
});

test('an explicit upstream stop cannot be weakened by title classification',()=>{
  assert.equal(publicCommerciallyEligible({name:'Generic item',commercialGate:'STOP_BRAND_GATE'}),false);
});

const now=new Date('2026-10-16T12:00:00Z');
const approved={name:'Foldable stand',brandPolicyClass:'GENERIC_PRIVATE_LABEL',brandReview:{reviewer:'Reviewer',reviewedAt:'2026-10-16T10:00:00Z',evidenceUrl:'https://evidence.example/brand'}};

test('public eligibility requires a recent documented generic/private-label review',()=>{
  assert.equal(publicCommerciallyEligible(approved,{now}),true);
  for(const brandReview of [undefined,{}, {...approved.brandReview,reviewer:''},{...approved.brandReview,evidenceUrl:'http://example.com'},{...approved.brandReview,reviewedAt:'invalid'},{...approved.brandReview,reviewedAt:'2026-10-17'},{...approved.brandReview,reviewedAt:'2026-09-15'}]){
    assert.equal(publicCommerciallyEligible({...approved,brandReview},{now}),false);
  }
  assert.equal(publicCommerciallyEligible({...approved,brandPolicyClass:'UNKNOWN_REVIEW'},{now}),false);
  assert.equal(publicCommerciallyEligible({...approved,brandPolicyClass:'UNKNOWN_REVIEW',commercialGate:'GENERIC_PRIVATE_LABEL'},{now}),false);
  assert.equal(publicCommerciallyEligible({...approved,commercialGate:'BRAND_REVIEW_REQUIRED'},{now}),false);
});

test('review metadata cannot override an established brand or conflicting stop',()=>{
  for(const change of [{brand:'Rubbermaid'},{title:'Sony stand'},{name:'Amazon Basics organizer'},{commercialGate:'STOP_BRAND_GATE'},{commercialGate:'ESTABLISHED_EXCLUDE'}]){
    assert.equal(publicCommerciallyEligible({...approved,...change},{now}),false);
  }
});

test('brand review expires after thirty days without being freshened by a product observation',()=>{
  const row={...approved,observedAt:now.toISOString(),brandReview:{...approved.brandReview,reviewedAt:'2026-09-16T12:00:00Z'}};
  assert.equal(publicCommerciallyEligible(row,{now}),true);
  assert.equal(publicCommerciallyEligible(row,{now:new Date(now.getTime()+1)}),false);
});
