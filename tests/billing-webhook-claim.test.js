import test from 'node:test';
import assert from 'node:assert/strict';
import {claimWebhookEvent} from '../netlify/functions/_billing-webhook-claim.mjs';

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-key'};
const event={id:'evt_retry_123',type:'customer.subscription.updated'};

function jsonResponse(body,{status=200}={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

test('claims a new Stripe webhook event',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    return jsonResponse({}, {status:201});
  };
  const claimed=await claimWebhookEvent(event,{env,fetchImpl});
  assert.equal(claimed,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options.method,'POST');
});

test('keeps already processed Stripe webhook events idempotent',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(calls.length===1)return jsonResponse({}, {status:409});
    return jsonResponse([{status:'PROCESSED'}]);
  };
  const claimed=await claimWebhookEvent(event,{env,fetchImpl});
  assert.equal(claimed,false);
  assert.equal(calls.length,2);
  assert.match(calls[1].url,/select=status/);
});

test('reclaims a previously failed Stripe webhook event for retry',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(calls.length===1)return jsonResponse({}, {status:409});
    if(calls.length===2)return jsonResponse([{status:'FAILED'}]);
    return jsonResponse([{stripe_event_id:event.id,status:'PROCESSING'}]);
  };
  const claimed=await claimWebhookEvent(event,{env,fetchImpl});
  assert.equal(claimed,true);
  assert.equal(calls.length,3);
  assert.equal(calls[2].options.method,'PATCH');
  assert.match(calls[2].url,/status=eq\.FAILED/);
  assert.equal(JSON.parse(calls[2].options.body).status,'PROCESSING');
});

test('allows only one concurrent delivery to reclaim a failed event',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(calls.length===1)return jsonResponse({}, {status:409});
    if(calls.length===2)return jsonResponse([{status:'FAILED'}]);
    return jsonResponse([]);
  };
  const claimed=await claimWebhookEvent(event,{env,fetchImpl});
  assert.equal(claimed,false);
  assert.equal(calls.length,3);
});
