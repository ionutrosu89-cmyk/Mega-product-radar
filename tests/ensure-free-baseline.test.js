import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureFreeBaseline} from '../scripts/ensure-free-baseline.mjs';

function response(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}

test('captures FREE_BASELINE only when acceptance is not started',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if((options.method||'GET')==='GET')return response(200,{ok:true,checkpointCount:0,nextStage:'FREE_BASELINE',verdict:'NO-GO'});
    return response(200,{ok:true,capturedStage:'FREE_BASELINE',checkpointCount:1,nextStage:'DISCOVER_ACTIVE',verdict:'NO-GO'});
  };
  const result=await ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',fetchImpl});
  assert.equal(result.action,'CAPTURED');
  assert.equal(result.checkpointCount,1);
  assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1].options.body).stage,'FREE_BASELINE');
  assert.equal(JSON.stringify(result).includes('secret-token'),false);
});

test('does not duplicate an existing acceptance journey',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls+=1;return response(200,{ok:true,checkpointCount:1,nextStage:'DISCOVER_ACTIVE',verdict:'NO-GO'});};
  const result=await ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',fetchImpl});
  assert.equal(result.action,'NOOP');
  assert.equal(calls,1);
});

test('fails closed when acceptance lookup is unavailable',async()=>{
  await assert.rejects(()=>ensureFreeBaseline({baseUrl:'https://example.test',token:'secret-token',fetchImpl:async()=>response(401,{ok:false})}),/lookup failed/);
});
