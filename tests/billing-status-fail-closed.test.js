import assert from 'node:assert/strict';
import test from 'node:test';
import {createBillingStatusHandler} from '../netlify/functions/billing-status.mjs';

function request(){return new Request('https://mpr.example/api/billing/status',{headers:{authorization:'Bearer token','x-mpr-workspace-id':'w1'}});}
function fetchForSubscription(subscriptionResponse){return async url=>{const value=String(url);if(value.includes('/auth/v1/user'))return Response.json({id:'u1'});if(value.includes('/rest/v1/workspace_members'))return Response.json([{workspace_id:'w1',user_id:'u1',role:'OWNER'}]);if(value.includes('/rest/v1/workspaces'))return Response.json([{id:'w1',name:'Workspace',plan:'RADAR',owner_id:'u1'}]);if(value.includes('/rest/v1/subscriptions'))return subscriptionResponse();return new Response(null,{status:404});};}
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'};

test('billing status never converts a subscription lookup outage into a fake FREE state',async()=>{
  const handler=createBillingStatusHandler({fetch:fetchForSubscription(()=>new Response('upstream failure',{status:503})),env});
  const response=await handler(request());
  assert.equal(response.status,502);
  const body=await response.json();
  assert.equal(body.ok,false);
  assert.equal(body.code,'SUBSCRIPTION_STATUS_LOOKUP_FAILED');
});

test('a successful empty subscription lookup remains a legitimate no-subscription state',async()=>{
  const handler=createBillingStatusHandler({fetch:fetchForSubscription(()=>Response.json([])),env});
  const response=await handler(request());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.workspace.plan,'RADAR');
  assert.equal(body.subscription,null);
});
