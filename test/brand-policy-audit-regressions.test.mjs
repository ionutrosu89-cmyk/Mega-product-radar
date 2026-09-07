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
  // WallPeg is itself already a reviewed established brand phrase, so this product is
  // excluded for the correct reason rather than because of the generic word "nerf".
  assert.equal(result.brandPolicyClass,'ESTABLISHED_EXCLUDE');
  assert.equal(result.matchedBrand,null);
  assert.match(result.reason,/Brand consacrat exclus/);
});
