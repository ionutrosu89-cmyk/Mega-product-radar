import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyPublicBrandGate} from '../brand-policy-v1.js';

test('Fiskars is excluded from the public commercial funnel',()=>{
  const result=classifyPublicBrandGate({name:'Fiskars Bypass Pruning Shears'});
  assert.equal(result.brandPolicyClass,'ESTABLISHED_EXCLUDE');
  assert.equal(result.commercialEligible,false);
  assert.equal(result.matchedBrand,'fiskars');
});

test('licensed Nerf Dog product is excluded from the public commercial funnel',()=>{
  const result=classifyPublicBrandGate({name:'Nerf Dog Tennis Ball Dog Toy'});
  assert.equal(result.brandPolicyClass,'ESTABLISHED_EXCLUDE');
  assert.equal(result.commercialEligible,false);
  assert.equal(result.matchedBrand,'nerf dog');
});

test('generic organizer mentioning nerf storage is not falsely classified as Nerf brand',()=>{
  const result=classifyPublicBrandGate({name:'WallPeg Peg Board Tool Organizer - nerf Gun Storage'});
  assert.equal(result.brandPolicyClass,'UNKNOWN_REVIEW');
  assert.equal(result.commercialEligible,true);
  assert.equal(result.matchedBrand,null);
});
