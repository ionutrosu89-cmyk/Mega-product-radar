import assert from 'node:assert/strict';
import test from 'node:test';
import {EBAY_BUY_AUTH,resetEbayTokenCacheForTests} from '../netlify/functions/_ebay-buy-auth.mjs';
import {getEbayCategorySuggestions,normalizeCategorySuggestions} from '../netlify/functions/_ebay-taxonomy-review.mjs';
import {createEbayCategoryReviewHandler} from '../netlify/functions/ebay-category-review.mjs';

const readyEnv={EBAY_CLIENT_ID:'client',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true',MPR_INTERNAL_REFRESH_SECRET:'internal'};

test('taxonomy suggestions are never auto-approved or activation eligible',()=>{
  const rows=normalizeCategorySuggestions({categorySuggestions:[{category:{categoryId:'123',categoryName:'Cable Management'},categoryTreeNodeAncestors:[{categoryId:'1',categoryName:'Home'}]}]},{marketplaceId:'EBAY_US',query:'cable tray'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].categoryId,'123');
  assert.equal(rows[0].reviewState,'REVIEW_REQUIRED');
  assert.equal(rows[0].activationEligible,false);
  assert.equal(rows[0].evidenceClass,'EBAY_TAXONOMY_SUGGESTION');
});

test('taxonomy review performs official tree plus suggestion calls with taxonomy scope',async()=>{
  resetEbayTokenCacheForTests();
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/identity/v1/oauth2/token')){
      assert.equal(String(options.body.get('scope')),EBAY_BUY_AUTH.taxonomyScope);
      return Response.json({access_token:'taxonomy-token',expires_in:7200});
    }
    if(String(url).includes('get_default_category_tree_id'))return Response.json({categoryTreeId:'0',categoryTreeVersion:'120'});
    if(String(url).includes('get_category_suggestions'))return Response.json({categorySuggestions:[{category:{categoryId:'123',categoryName:'Cable Management'}}]});
    return new Response(null,{status:404});
  };
  const result=await getEbayCategorySuggestions({query:'cable tray',marketplaceId:'EBAY_US',env:readyEnv,fetchImpl,now:()=>0});
  assert.equal(result.ok,true);
  assert.equal(result.code,'REVIEW_REQUIRED');
  assert.equal(result.providerCalls,2);
  assert.equal(result.categoryTreeId,'0');
  assert.equal(result.suggestions[0].activationEligible,false);
  assert.equal(calls.length,3);
});

test('taxonomy review is zero-call when access or input is not ready',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return new Response(null,{status:500});};
  const access=await getEbayCategorySuggestions({query:'cable tray',env:{},fetchImpl});
  assert.equal(access.code,'EBAY_ACCESS_NOT_READY');
  const missing=await getEbayCategorySuggestions({query:'',env:readyEnv,fetchImpl});
  assert.equal(missing.code,'QUERY_REQUIRED');
  const unsupported=await getEbayCategorySuggestions({query:'cable tray',marketplaceId:'EBAY_FR',env:readyEnv,fetchImpl});
  assert.equal(unsupported.code,'MARKETPLACE_UNSUPPORTED');
  assert.equal(calls,0);
});

test('protected review endpoint rejects unauthorized calls and returns review-only suggestions',async()=>{
  resetEbayTokenCacheForTests();
  let providerCalls=0;
  const fetchImpl=async(url,options={})=>{
    providerCalls+=1;
    if(String(url).includes('/identity/v1/oauth2/token'))return Response.json({access_token:'t',expires_in:7200});
    if(String(url).includes('get_default_category_tree_id'))return Response.json({categoryTreeId:'0',categoryTreeVersion:'120'});
    return Response.json({categorySuggestions:[{category:{categoryId:'456',categoryName:'Desk Accessories'}}]});
  };
  const handler=createEbayCategoryReviewHandler({env:readyEnv,fetchImpl,now:()=>0});
  const unauthorized=await handler(new Request('https://mpr.test/api/internal/ebay-category-review',{method:'POST',body:JSON.stringify({query:'desk organizer'}),headers:{'content-type':'application/json'}}));
  assert.equal(unauthorized.status,401);
  assert.equal(providerCalls,0);
  const response=await handler(new Request('https://mpr.test/api/internal/ebay-category-review',{method:'POST',body:JSON.stringify({query:'desk organizer'}),headers:{'content-type':'application/json','x-mpr-internal-secret':'internal'}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.policy.humanApprovalRequired,true);
  assert.equal(body.policy.purchaseAuthorized,false);
  assert.equal(body.suggestions[0].reviewState,'REVIEW_REQUIRED');
});
