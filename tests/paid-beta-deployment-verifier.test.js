import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeBaseUrl,verifyPaidBetaDeployment} from '../scripts/verify-paid-beta-deployment.mjs';

const token='super-secret-admin-token';
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
function mockFetch({billing={ok:true,ready:true,stripeMode:'SANDBOX',publicLaunchBillingReady:false},runtime={ok:true,ready:true},legal={ok:true,ready:false},sandbox={ok:true,ready:true,configured:true,checks:{workspaceConfigured:true,workspaceExists:true,workspaceFree:true,zeroActiveSubscriptions:true,noScheduledCancellation:true,inactiveLocalSubscription:true},reason:null}}={}){
  return async (url,options)=>{
    assert.equal(options.headers.authorization,`Bearer ${token}`);
    const value=String(url);
    if(value.endsWith('/api/internal/billing-readiness'))return response(billing);
    if(value.endsWith('/api/internal/paid-beta-runtime-readiness'))return response(runtime);
    if(value.endsWith('/api/internal/legal-readiness'))return response(legal);
    if(value.endsWith('/api/internal/sandbox-preflight-readiness'))return response(sandbox);
    return response({error:'not found'},404);
  };
}

test('normalizes HTTPS deployment URL and rejects insecure remote origins',()=>{
  assert.equal(normalizeBaseUrl('https://mpr.example/some/path?x=1'),'https://mpr.example');
  assert.throws(()=>normalizeBaseUrl('http://mpr.example'),/HTTPS/);
  assert.equal(normalizeBaseUrl('http://localhost:8888/foo'),'http://localhost:8888');
});

test('sandbox gate requires Stripe sandbox readiness plus deployed database runtime and clean server-resolved workspace',async()=>{
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token,gate:'SANDBOX',fetchImpl:mockFetch()});
  assert.equal(result.ok,true);
  assert.equal(result.verdict,'GO');
  assert.equal(result.checks.stripeMode,'SANDBOX');
  assert.equal(result.checks.databaseRuntimeReady,true);
  assert.equal(result.checks.sandboxWorkspaceClean,true);
  assert.equal(result.checks.legalP0Ready,false);
  assert.equal(JSON.stringify(result).includes(token),false);
});

test('sandbox gate fails closed when runtime DB is not ready',async()=>{
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token,gate:'SANDBOX',fetchImpl:mockFetch({runtime:{ok:true,ready:false}})});
  assert.equal(result.ok,false);
  assert.equal(result.verdict,'NO-GO');
  assert.equal(result.checks.databaseRuntimeReady,false);
});

test('sandbox gate fails closed when server-side workspace preflight is blocked',async()=>{
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token,gate:'SANDBOX',fetchImpl:mockFetch({sandbox:{ok:true,ready:false,configured:true,checks:{workspaceConfigured:true,workspaceExists:true,workspaceFree:false,zeroActiveSubscriptions:true,noScheduledCancellation:true,inactiveLocalSubscription:true},reason:'SANDBOX_WORKSPACE_NOT_CLEAN'}})});
  assert.equal(result.ok,false);
  assert.equal(result.checks.sandboxWorkspaceClean,false);
  assert.equal(result.sandboxWorkspace.reason,'SANDBOX_WORKSPACE_NOT_CLEAN');
});

test('live prerequisites require live billing, DB runtime and legal P0',async()=>{
  const fetchImpl=mockFetch({billing:{ok:true,ready:true,stripeMode:'LIVE',publicLaunchBillingReady:true},runtime:{ok:true,ready:true},legal:{ok:true,ready:true}});
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token,gate:'LIVE_PREREQS',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.checks.livePrereqsReady,true);
  assert.match(result.note,/Public Commercial GO still requires/);
});

test('diagnostic HTTP failure cannot be misread as GO and does not expose token',async()=>{
  const fetchImpl=async (url,options)=>{
    assert.equal(options.headers.authorization,`Bearer ${token}`);
    const value=String(url);
    if(value.endsWith('/api/internal/legal-readiness'))return response({error:'Admin allowlist is not configured'},503);
    if(value.endsWith('/api/internal/billing-readiness'))return response({ok:true,ready:true,stripeMode:'SANDBOX'});
    if(value.endsWith('/api/internal/paid-beta-runtime-readiness'))return response({ok:true,ready:true});
    if(value.endsWith('/api/internal/sandbox-preflight-readiness'))return response({ok:true,ready:true,configured:true,checks:{workspaceConfigured:true,workspaceExists:true,workspaceFree:true,zeroActiveSubscriptions:true,noScheduledCancellation:true,inactiveLocalSubscription:true}});
    return response({error:'not found'},404);
  };
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token,gate:'SANDBOX',fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.checks.diagnosticsReachable,false);
  assert.equal(result.endpoints.legal.status,503);
  assert.equal(JSON.stringify(result).includes(token),false);
});
