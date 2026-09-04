import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCategoryCoverageReview,getEbayCategoryCoverageReview} from '../netlify/functions/_ebay-taxonomy-review.mjs';

const tree={category:{categoryId:'0',categoryName:'Root'},leafCategoryTreeNode:false,childCategoryTreeNodes:[
  {category:{categoryId:'1',categoryName:'Home & Garden'},leafCategoryTreeNode:false,childCategoryTreeNodes:[{category:{categoryId:'11',categoryName:'Home Organization'},leafCategoryTreeNode:true}]},
  {category:{categoryId:'2',categoryName:'Sporting Goods'},leafCategoryTreeNode:false,childCategoryTreeNodes:[{category:{categoryId:'22',categoryName:'Fitness'},leafCategoryTreeNode:true}]}
]};

test('coverage review evaluates all canonical niches without activating candidates',()=>{
  const review=buildCategoryCoverageReview({marketplaceId:'EBAY_US',treeId:'0',treeVersion:'123',rootCategoryNode:tree});
  assert.equal(review.targetCount,25);
  assert.equal(review.policy.autoApproval,false);
  assert.equal(review.policy.autoActivation,false);
  assert.equal(review.policy.syntheticProductRanking,false);
  const casa=review.targets.find(row=>row.nicheId==='CASA');
  assert.equal(casa.reviewState,'REVIEW_REQUIRED');
  assert.equal(casa.activationEligible,false);
  assert.equal(casa.candidates[0].categoryId,'1');
  assert.equal(casa.candidates[0].activationEligible,false);
  assert.equal(casa.candidates[0].evidenceClass,'EBAY_CATEGORY_TREE_REVIEW_CANDIDATE');
});

test('coverage review makes zero provider calls before eBay production access is approved',async()=>{
  let calls=0;
  const result=await getEbayCategoryCoverageReview({marketplaceId:'EBAY_US',env:{},fetchImpl:async()=>{calls++;throw new Error('must not call');}});
  assert.equal(result.ok,false);
  assert.equal(result.code,'EBAY_ACCESS_NOT_READY');
  assert.equal(result.providerCalls,0);
  assert.equal(calls,0);
});

test('unsupported marketplace is rejected before provider calls',async()=>{
  let calls=0;
  const env={EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true'};
  const result=await getEbayCategoryCoverageReview({marketplaceId:'EBAY_RO',env,fetchImpl:async()=>{calls++;throw new Error('must not call');}});
  assert.equal(result.code,'MARKETPLACE_UNSUPPORTED');
  assert.equal(result.providerCalls,0);
  assert.equal(calls,0);
});
