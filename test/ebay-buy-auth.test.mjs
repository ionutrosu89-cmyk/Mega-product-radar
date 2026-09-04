import assert from 'node:assert/strict';
import test from 'node:test';
import {ebayBuyAccessState,getEbayApplicationToken,resetEbayTokenCacheForTests,EBAY_BUY_AUTH} from '../netlify/functions/_ebay-buy-auth.mjs';

test('eBay Buy access fails closed until credentials and production approval exist',()=>{
  assert.equal(ebayBuyAccessState({}),'ACCESS_REQUIRED');
  assert.equal(ebayBuyAccessState({EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret'}),'TERMS_REVIEW_REQUIRED');
  assert.equal(ebayBuyAccessState({EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true'}),'TERMS_REVIEW_REQUIRED');
  assert.equal(ebayBuyAccessState({EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true'}),'READY_TO_COLLECT');
});

test('eBay application token is minted server-side and reused before expiry',async()=>{
  resetEbayTokenCacheForTests();
  const calls=[];
  const env={EBAY_CLIENT_ID:'client-id',EBAY_CLIENT_SECRET:'client-secret',MPR_EBAY_TERMS_APPROVED:'true',MPR_EBAY_PRODUCTION_ACCESS_APPROVED:'true'};
  const fetchImpl=async (url,options)=>{
    calls.push({url:String(url),options});
    return Response.json({access_token:'application-token',expires_in:7200});
  };
  const first=await getEbayApplicationToken({env,fetchImpl,now:()=>1_000_000});
  const second=await getEbayApplicationToken({env,fetchImpl,now:()=>2_000_000});
  assert.equal(first,'application-token');
  assert.equal(second,'application-token');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,EBAY_BUY_AUTH.tokenUrl);
  assert.equal(calls[0].options.method,'POST');
  assert.match(calls[0].options.headers.authorization,/^Basic /);
  assert.equal(String(calls[0].options.body),`grant_type=client_credentials&scope=${encodeURIComponent(EBAY_BUY_AUTH.scope)}`);
});

test('eBay token minting never calls provider while access is unapproved',async()=>{
  resetEbayTokenCacheForTests();
  let called=false;
  await assert.rejects(()=>getEbayApplicationToken({env:{EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret'},fetchImpl:async()=>{called=true;return Response.json({});}}),/EBAY_ACCESS_NOT_READY/);
  assert.equal(called,false);
});
