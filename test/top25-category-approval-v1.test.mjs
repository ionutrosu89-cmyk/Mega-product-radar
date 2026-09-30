import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {compileTop25Targets,reviewTop25CategoryMappings} from '../top25-category-approval-v1.js';

const review=JSON.parse(readFileSync(new URL('../data/top25-niche-review-v1.json',import.meta.url),'utf8'));
test('all 25 niche scopes exist and no category is silently approved',()=>{
  assert.equal(reviewTop25CategoryMappings(review).ok,true);
  assert.equal(review.pilotNicheIds.length,3);
  for(const provider of ['EBAY_US','EBAY_DE','ALIEXPRESS'])assert.deepEqual(compileTop25Targets(review,{provider}).targets,[]);
});

test('approved category needs reviewer, recent date and provider category ID',()=>{
  const changed=structuredClone(review);
  changed.niches[0].mappingStatus='APPROVED';
  changed.niches[0].ebayUsCategoryId='12345';
  assert.equal(compileTop25Targets(changed,{provider:'EBAY_US',now:new Date('2026-09-23')}).ok,false);
  Object.assign(changed.niches[0],{reviewer:'Operator',reviewedAt:'2026-09-23',categoryEvidenceUrl:'https://developer.ebay.com/category/12345'});
  assert.deepEqual(compileTop25Targets(changed,{provider:'EBAY_US',now:new Date('2026-09-23')}).targets,[{nicheId:'CASA',categoryId:'12345',marketplaceId:'EBAY_US'}]);
});
