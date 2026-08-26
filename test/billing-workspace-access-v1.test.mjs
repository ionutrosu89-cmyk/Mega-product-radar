import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedWorkspaceId,roleAllowed,resolveBillingWorkspaceAccess} from '../netlify/functions/_billing-workspace-access.mjs';

function req(headers={}){return {headers:new Headers(headers)};}

function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}

function mockFetchForRole(role='OWNER'){
  return async url=>{
    const s=String(url);
    if(s.includes('/auth/v1/user'))return jsonResponse({id:'user-1',email:'owner@example.com'});
    if(s.includes('/rest/v1/workspace_members'))return jsonResponse(role?[{workspace_id:'ws-1',user_id:'user-1',role}]:[]);
    if(s.includes('/rest/v1/workspaces'))return jsonResponse([{id:'ws-1',name:'Workspace',plan:'RADAR'}]);
    if(s.includes('/rest/v1/subscriptions'))return jsonResponse([{workspace_id:'ws-1',plan:'RADAR',status:'active',provider_subscription_id:'sub_1',cancel_at_period_end:false}]);
    return jsonResponse({},404);
  };
}

test('workspace header is mandatory and explicit',()=>{
  assert.equal(requestedWorkspaceId(req()),null);
  assert.equal(requestedWorkspaceId(req({'x-mpr-workspace-id':'ws-1'})),'ws-1');
});

test('billing mutation role policy is owner-only',()=>{
  assert.equal(roleAllowed('OWNER','OWNER'),true);
  assert.equal(roleAllowed('ADMIN','OWNER'),false);
  assert.equal(roleAllowed('MEMBER','OWNER'),false);
  assert.equal(roleAllowed('ADMIN','OWNER_OR_ADMIN'),true);
});

test('member cannot obtain billing mutation access',async()=>{
  const result=await resolveBillingWorkspaceAccess(req({authorization:'Bearer token','x-mpr-workspace-id':'ws-1'}),{fetchImpl:mockFetchForRole('MEMBER'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'},mode:'OWNER'});
  assert.equal(result.status,403);
  assert.equal(result.code,'BILLING_OWNER_REQUIRED');
});

test('owner access is bound to the requested workspace',async()=>{
  const result=await resolveBillingWorkspaceAccess(req({authorization:'Bearer token','x-mpr-workspace-id':'ws-1'}),{fetchImpl:mockFetchForRole('OWNER'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'},mode:'OWNER'});
  assert.equal(result.workspace.id,'ws-1');
  assert.equal(result.membership.role,'OWNER');
  assert.equal(result.subscription.provider_subscription_id,'sub_1');
});

test('missing explicit workspace context fails closed',async()=>{
  const result=await resolveBillingWorkspaceAccess(req({authorization:'Bearer token'}),{fetchImpl:mockFetchForRole('OWNER'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon'},mode:'OWNER'});
  assert.equal(result.status,400);
  assert.equal(result.code,'WORKSPACE_CONTEXT_REQUIRED');
});
