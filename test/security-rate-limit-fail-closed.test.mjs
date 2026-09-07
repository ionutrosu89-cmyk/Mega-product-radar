import assert from 'node:assert/strict';
import test from 'node:test';
import {enforceRateLimit} from '../netlify/functions/_security-ops.mjs';

const request=new Request('https://example.test/api/free/top25',{headers:{'x-forwarded-for':'203.0.113.10'}});
const productionEnv={
  CONTEXT:'production',
  SECURITY_AUDIT_SALT:'0123456789abcdef0123456789abcdef',
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'test-service-role-value'
};

test('production rate limiting fails closed when the shared backend errors',async()=>{
  const result=await enforceRateLimit(request,{
    route:'test-free',
    env:productionEnv,
    fetchImpl:async()=>{throw new Error('shared store unavailable');}
  });
  assert.equal(result.ok,false);
  assert.equal(result.status,503);
  assert.equal(result.mode,'FAIL_CLOSED');
  assert.equal(result.code,'RATE_LIMIT_BACKEND_UNAVAILABLE');
});

test('production rate limiting fails closed when the shared backend rejects the RPC',async()=>{
  const result=await enforceRateLimit(request,{
    route:'test-free',
    env:productionEnv,
    fetchImpl:async()=>new Response('down',{status:503})
  });
  assert.equal(result.ok,false);
  assert.equal(result.status,503);
  assert.equal(result.mode,'FAIL_CLOSED');
});

test('non-production may use local fallback when the shared backend errors',async()=>{
  const result=await enforceRateLimit(request,{
    route:'test-free-development',
    env:{...productionEnv,CONTEXT:'dev'},
    fetchImpl:async()=>{throw new Error('shared store unavailable');}
  });
  assert.equal(result.ok,true);
  assert.equal(result.mode,'LOCAL_FALLBACK');
});
