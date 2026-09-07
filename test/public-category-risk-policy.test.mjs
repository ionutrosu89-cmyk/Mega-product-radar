import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPublicCategoryRisk} from '../public-category-risk-policy-v1.js';

test('blocks clearly regulated product categories',()=>{
  for(const name of ['Vape starter kit','Pepper spray compact','THC gummies','9mm ammunition','Bottle of vodka','Adult vibrator']){
    const result=classifyPublicCategoryRisk({name});
    assert.equal(result.decision,'BLOCK',name);
    assert.equal(result.commercialEligible,false,name);
  }
});

test('routes bladed tools to manual review instead of silently promoting them',()=>{
  const result=classifyPublicCategoryRisk({name:'Window tint kit with utility knife and blades'});
  assert.equal(result.decision,'MANUAL_REVIEW');
  assert.equal(result.commercialEligible,false);
  assert.equal(result.riskClass,'BLADED_TOOL');
});

test('uses word boundaries so harmless substrings are not blocked',()=>{
  for(const name of ['Natural jute twine rope','Brown plant hanger','Nerf Gun Storage Peg Board','Mini suitcase favor box with burlap twine']){
    const result=classifyPublicCategoryRisk({name});
    assert.equal(result.decision,'ALLOW',name);
  }
});
