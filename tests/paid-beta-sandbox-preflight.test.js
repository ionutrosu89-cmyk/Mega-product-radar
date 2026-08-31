import assert from 'node:assert/strict';
import test from 'node:test';
import {assessSandboxWorkspacePreflight,verifyPaidBetaDeployment} from '../scripts/verify-paid-beta-deployment.mjs';

const cleanCheckpoint={
  environment:'SANDBOX',workspaceId:'ws-sandbox',workspacePlan:'FREE',subscriptionStatus:'none',
  activeSubscriptionCount:0,cancelAtPeriodEnd:false
};

function safeSandbox(checkpoint=cleanCheckpoint){
  const state=assessSandboxWorkspacePreflight(checkpoint);
  return {
    ok:true,
    ready:state.clean,
    configured:true,
    checks:{
      workspaceConfigured:true,
      workspaceExists:true,
      workspaceFree:state.workspacePlan==='FREE',
      zeroActiveSubscriptions:state.activeSubscriptionCount===0,
      noScheduledCancellation:state.cancelAtPeriodEnd===false,
      inactiveLocalSubscription:['none','canceled','cancelled','incomplete_expired','unpaid'].includes(state.subscriptionStatus)
    },
    reason:state.clean?null:'SANDBOX_WORKSPACE_NOT_CLEAN'
  };
}

function deploymentFetch({checkpoint=cleanCheckpoint,billing={},runtime={},legal={}}={}){
  return async url=>{
    const path=new URL(String(url)).pathname;
    if(path==='/api/internal/billing-readiness')return Response.json({ready:true,stripeMode:'SANDBOX',publicLaunchBillingReady:false,...billing});
    if(path==='/api/internal/paid-beta-runtime-readiness')return Response.json({ready:true,...runtime});
    if(path==='/api/internal/legal-readiness')return Response.json({ready:false,...legal});
    if(path==='/api/internal/sandbox-preflight-readiness')return Response.json(safeSandbox(checkpoint));
    return new Response(null,{status:404});
  };
}

test('clean FREE sandbox workspace with zero active subscriptions can satisfy SANDBOX deployment preflight',async()=>{
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token:'probe',gate:'SANDBOX',fetchImpl:deploymentFetch()});
  assert.equal(result.ok,true);
  assert.equal(result.checks.sandboxWorkspaceClean,true);
  assert.equal(result.sandboxWorkspace.checks.workspaceFree,true);
  assert.equal(result.sandboxWorkspace.checks.zeroActiveSubscriptions,true);
});

test('SANDBOX gate delegates dedicated workspace resolution to the protected server preflight',async()=>{
  let sandboxTouched=false;
  const fetchImpl=async url=>{
    const path=new URL(String(url)).pathname;
    if(path==='/api/internal/billing-readiness')return Response.json({ready:true,stripeMode:'SANDBOX',publicLaunchBillingReady:false});
    if(path==='/api/internal/paid-beta-runtime-readiness')return Response.json({ready:true});
    if(path==='/api/internal/legal-readiness')return Response.json({ready:false});
    if(path==='/api/internal/sandbox-preflight-readiness'){sandboxTouched=true;return Response.json(safeSandbox());}
    return new Response(null,{status:404});
  };
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token:'probe',gate:'SANDBOX',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(sandboxTouched,true);
});

test('paid workspace cannot be reused as sandbox baseline',async()=>{
  const checkpoint={...cleanCheckpoint,workspacePlan:'RADAR',subscriptionStatus:'active',activeSubscriptionCount:1};
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token:'probe',gate:'SANDBOX',fetchImpl:deploymentFetch({checkpoint})});
  assert.equal(result.ok,false);
  assert.equal(result.checks.sandboxWorkspaceClean,false);
  assert.equal(result.sandboxWorkspace.checks.workspaceFree,false);
});

test('any active or trialing Stripe subscription blocks sandbox preflight even if workspace says FREE',async()=>{
  const checkpoint={...cleanCheckpoint,subscriptionStatus:'canceled',activeSubscriptionCount:1};
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token:'probe',gate:'SANDBOX',fetchImpl:deploymentFetch({checkpoint})});
  assert.equal(result.ok,false);
  assert.equal(result.sandboxWorkspace.checks.zeroActiveSubscriptions,false);
});

test('scheduled cancellation residue blocks clean sandbox baseline',()=>{
  const verdict=assessSandboxWorkspacePreflight({...cleanCheckpoint,subscriptionStatus:'active',cancelAtPeriodEnd:true});
  assert.equal(verdict.clean,false);
});

test('LIVE_PREREQS does not require or query the sandbox workspace',async()=>{
  let sandboxTouched=false;
  const fetchImpl=async url=>{
    const path=new URL(String(url)).pathname;
    if(path==='/api/internal/billing-readiness')return Response.json({ready:true,stripeMode:'LIVE',publicLaunchBillingReady:true});
    if(path==='/api/internal/paid-beta-runtime-readiness')return Response.json({ready:true});
    if(path==='/api/internal/legal-readiness')return Response.json({ready:true});
    if(path==='/api/internal/sandbox-preflight-readiness'){sandboxTouched=true;return Response.json(safeSandbox());}
    return new Response(null,{status:404});
  };
  const result=await verifyPaidBetaDeployment({baseUrl:'https://mpr.example',token:'probe',gate:'LIVE_PREREQS',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(sandboxTouched,false);
});
