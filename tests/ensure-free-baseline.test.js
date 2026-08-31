import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureFreeBaseline} from '../scripts/ensure-free-baseline.mjs';

const deploymentRef='1234567890abcdef1234567890abcdef12345678';
function response(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}

test('captures FREE_BASELINE only when acceptance is not started',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if((options.method||'GET')==='GET')return response(200,{ok:true,checkpointCount:0,nextStage:'FREE_BASELINE',verdict:'NO-GO'});
    return response(200,{ok:true,capturedStage:'FREE_BASELINE',checkpointCount:1,nextStage:'DISCOVER_ACTIVE',verdict:'NO-GO'});
  };
  const result=await ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',deploymentRef,fetchImpl});
  assert.equal(result.action,'CAPTURED');
  assert.equal(result.checkpointCount,1);
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers['x-mpr-deployment-ref'],deploymentRef);
  assert.equal(calls[1].options.headers['x-mpr-deployment-ref'],deploymentRef);
  assert.equal(JSON.parse(calls[1].options.body).stage,'FREE_BASELINE');
  assert.equal(JSON.stringify(result).includes('secret-token'),false);
});

test('does not duplicate an existing acceptance journey',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return response(200,{ok:true,checkpointCount:1,nextStage:'DISCOVER_ACTIVE',verdict:'NO-GO'});};
  const result=await ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',deploymentRef,fetchImpl});
  assert.equal(result.action,'NOOP');
  assert.equal(calls,1);
});

test('rejects malformed deployment refs before making a network call',async()=>{
  let calls=0;
  await assert.rejects(()=>ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',deploymentRef:'bad-ref',fetchImpl:async()=>{calls+=1;return response(200,{ok:true});}}),/full GitHub commit SHA/);
  assert.equal(calls,0);
});

test('fails closed with safe server code when acceptance lookup is unavailable',async()=>{
  await assert.rejects(()=>ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',deploymentRef,fetchImpl:async()=>response(503,{ok:false,code:'DEPLOYMENT_REF_NOT_CONFIGURED'})}),/DEPLOYMENT_REF_NOT_CONFIGURED/);
});
