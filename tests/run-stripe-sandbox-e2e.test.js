import test from 'node:test';
import assert from 'node:assert/strict';
import {runStripeSandboxE2e} from '../scripts/run-stripe-sandbox-e2e.mjs';

const ref='1234567890abcdef1234567890abcdef12345678';
const stages=['DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
function ledger(count){return {ok:true,checkpointCount:count,nextStage:count===6?null:stages[count-1],verdict:count===6?'GO':'NO-GO'};}

test('runner advances five webhook-backed stages from 1/6 to machine GO',async()=>{
  let count=1;let mutatedStage=null;const transitioned=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);const method=options.method||'GET';
    if(value.endsWith('/billing-e2e-sandbox-transition')){
      const stage=JSON.parse(options.body).stage;transitioned.push(stage);mutatedStage=stage;
      return response({ok:true,stage,realMoney:false,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'});
    }
    if(value.endsWith('/billing-e2e-acceptance')&&method==='POST'){
      const stage=JSON.parse(options.body).stage;
      if(mutatedStage!==stage)return response({ok:false,code:'CHECKPOINT_NOT_OBSERVED'},409);
      count+=1;mutatedStage=null;
      return response({...ledger(count),capturedStage:stage});
    }
    if(value.endsWith('/billing-e2e-acceptance'))return response(ledger(count));
    return response({ok:false},404);
  };
  const result=await runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{},maxPolls:2,pollMs:0});
  assert.equal(result.verdict,'GO');assert.equal(result.checkpointCount,6);assert.deepEqual(transitioned,stages);assert.deepEqual(result.reconciled,[]);assert.equal(result.realMoney,false);
});

test('runner resumes safely from an existing partial ledger',async()=>{
  let count=3;let mutatedStage=null;const transitioned=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);const method=options.method||'GET';
    if(value.endsWith('/billing-e2e-sandbox-transition')){
      const stage=JSON.parse(options.body).stage;transitioned.push(stage);mutatedStage=stage;
      return response({ok:true,stage,realMoney:false,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'});
    }
    if(value.endsWith('/billing-e2e-acceptance')&&method==='POST'){
      const stage=JSON.parse(options.body).stage;
      if(mutatedStage!==stage)return response({ok:false,code:'CHECKPOINT_NOT_OBSERVED'},409);
      count+=1;mutatedStage=null;return response({...ledger(count),capturedStage:stage});
    }
    return response(ledger(count));
  };
  const result=await runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{},maxPolls:2,pollMs:0});
  assert.equal(result.verdict,'GO');
  assert.deepEqual(transitioned,['LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE']);
});

test('runner reconciles webhook-observed next stage before mutating it again',async()=>{
  let count=1;let discoverAlreadyObserved=true;let mutatedStage=null;const transitioned=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);const method=options.method||'GET';
    if(value.endsWith('/billing-e2e-sandbox-transition')){
      const stage=JSON.parse(options.body).stage;transitioned.push(stage);mutatedStage=stage;
      return response({ok:true,stage,realMoney:false,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'});
    }
    if(value.endsWith('/billing-e2e-acceptance')&&method==='POST'){
      const stage=JSON.parse(options.body).stage;
      if(stage==='DISCOVER_ACTIVE'&&discoverAlreadyObserved){discoverAlreadyObserved=false;count=2;return response({...ledger(count),capturedStage:stage});}
      if(mutatedStage!==stage)return response({ok:false,code:'CHECKPOINT_NOT_OBSERVED'},409);
      count+=1;mutatedStage=null;return response({...ledger(count),capturedStage:stage});
    }
    return response(ledger(count));
  };
  const result=await runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{},maxPolls:2,pollMs:0});
  assert.equal(result.verdict,'GO');
  assert.deepEqual(result.reconciled,['DISCOVER_ACTIVE']);
  assert.deepEqual(transitioned,['RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE']);
});

test('runner is idempotent when current-deploy ledger is already 6/6 GO',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return response(ledger(6));};
  const result=await runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{}});
  assert.equal(result.alreadyComplete,true);assert.equal(result.verdict,'GO');assert.equal(calls,1);
});

test('runner refuses to start without a verified FREE baseline',async()=>{
  const fetchImpl=async()=>response({ok:true,checkpointCount:0,nextStage:'FREE_BASELINE',verdict:'NO-GO'});
  await assert.rejects(()=>runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{}}),/verified FREE baseline/);
});

test('runner rejects an inconsistent ledger',async()=>{
  const fetchImpl=async()=>response({ok:true,checkpointCount:2,nextStage:'LAUNCH_ACTIVE',verdict:'NO-GO'});
  await assert.rejects(()=>runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{}}),/ledger is inconsistent/);
});

test('runner rejects a transition that does not prove sandbox and webhook-only authority',async()=>{
  let reads=0;
  const fetchImpl=async(url,options={})=>{
    const value=String(url);const method=options.method||'GET';
    if(value.endsWith('/billing-e2e-acceptance')&&method==='GET'){reads+=1;return response(ledger(1));}
    if(value.endsWith('/billing-e2e-acceptance')&&method==='POST')return response({ok:false,code:'CHECKPOINT_NOT_OBSERVED'},409);
    if(value.endsWith('/billing-e2e-sandbox-transition'))return response({ok:true,realMoney:true,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'});
    return response({ok:false},500);
  };
  await assert.rejects(()=>runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{}}),/did not prove sandbox\/webhook-only safety/);
  assert.ok(reads>=2);
});
