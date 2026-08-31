import test from 'node:test';
import assert from 'node:assert/strict';
import {runStripeSandboxE2e} from '../scripts/run-stripe-sandbox-e2e.mjs';

const ref='1234567890abcdef1234567890abcdef12345678';
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}

test('runner advances five webhook-backed stages from 1/6 to machine GO',async()=>{
  const stages=['DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'];
  let count=1;let next='DISCOVER_ACTIVE';const transitioned=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);const method=options.method||'GET';
    if(value.endsWith('/billing-e2e-sandbox-transition')){
      const stage=JSON.parse(options.body).stage;transitioned.push(stage);
      return response({ok:true,stage,realMoney:false,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'});
    }
    if(value.endsWith('/billing-e2e-acceptance')&&method==='POST'){
      const stage=JSON.parse(options.body).stage;
      assert.equal(stage,next);count+=1;next=stages[count-1]||null;
      return response({ok:true,capturedStage:stage,checkpointCount:count,nextStage:next,verdict:count===6?'GO':'NO-GO'});
    }
    if(value.endsWith('/billing-e2e-acceptance'))return response({ok:true,checkpointCount:count,nextStage:next,verdict:count===6?'GO':'NO-GO'});
    return response({ok:false},404);
  };
  const result=await runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{},maxPolls:2,pollMs:0});
  assert.equal(result.verdict,'GO');assert.equal(result.checkpointCount,6);assert.deepEqual(transitioned,stages);assert.equal(result.realMoney,false);
});

test('runner refuses to start unless FREE baseline is already 1/6',async()=>{
  const fetchImpl=async()=>response({ok:true,checkpointCount:0,nextStage:'FREE_BASELINE',verdict:'NO-GO'});
  await assert.rejects(()=>runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{}}),/verified FREE baseline/);
});

test('runner rejects a transition that does not prove sandbox and webhook-only authority',async()=>{
  let first=true;
  const fetchImpl=async(url,options={})=>{
    if(first){first=false;return response({ok:true,checkpointCount:1,nextStage:'DISCOVER_ACTIVE',verdict:'NO-GO'});}
    if(String(url).endsWith('/billing-e2e-sandbox-transition'))return response({ok:true,realMoney:true,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'});
    return response({ok:false},500);
  };
  await assert.rejects(()=>runStripeSandboxE2e({baseUrl:'https://mpr.example',token:'oidc-token',deploymentRef:ref,fetchImpl,sleepImpl:async()=>{}}),/did not prove sandbox\/webhook-only safety/);
});
