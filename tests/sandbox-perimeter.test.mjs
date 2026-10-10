import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxPerimeterDecision as decide} from '../netlify/edge-functions/sandbox-perimeter-policy.mjs';
const env={MPR_SANDBOX_ISOLATION:'true',MPR_SANDBOX_HOST:'sandbox.example'};
const req=(path,method='GET',headers={})=>new Request('https://sandbox.example'+path,{method,headers});
test('fails closed without explicit sandbox mode or matching dedicated host',()=>{
 assert.equal(decide(req('/'),{}).status,503);
 assert.equal(decide(req('/'),{...env,MPR_SANDBOX_HOST:'other.example'}).status,403);
});
test('denies UI, product data, direct function aliases and checkout routes',()=>{
 for(const path of ['/','/index.html','/top25.html','/products.json','/api/radar/data','/api/billing/checkout','/.netlify/functions/billing-webhook','/api/internal/billing-e2e-acceptance/']){
  assert.equal(decide(req(path),env).status,403,path);
 }
});
test('requires authentication header for internal read-only and mutation requests',()=>{
 assert.equal(decide(req('/api/internal/billing-e2e-acceptance'),env).status,401);
 assert.equal(decide(req('/api/internal/billing-e2e-sandbox-transition','POST'),env).status,401);
 assert.equal(decide(req('/api/internal/billing-e2e-acceptance','GET',{authorization:'Bearer candidate'}),env),null);
});
test('passes only POST signed webhook requests to signature verification',()=>{
 assert.equal(decide(req('/api/billing/webhook'),env).status,405);
 assert.equal(decide(req('/api/billing/webhook','POST'),env).status,400);
 assert.equal(decide(req('/api/billing/webhook','POST',{'stripe-signature':'candidate'}),env),null);
});
test('does not allow arbitrary methods or routes with a bearer token',()=>{
 assert.equal(decide(req('/api/internal/billing-e2e-acceptance','DELETE',{authorization:'Bearer candidate'}),env).status,405);
 assert.equal(decide(req('/api/other','GET',{authorization:'Bearer candidate'}),env).status,403);
});
