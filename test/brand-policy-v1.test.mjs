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

test('generic and unclassified small-brand candidates remain reviewable, not approved',()=>{
  const generic=classifyPublicBrandGate({name:'Foldable under-sink organizer'});
  assert.equal(generic.brandPolicyClass,'UNKNOWN_REVIEW');
  assert.equal(generic.commercialEligible,true);
  assert.equal(publicCommerciallyEligible({name:'Foldable under-sink organizer'}),true);
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
