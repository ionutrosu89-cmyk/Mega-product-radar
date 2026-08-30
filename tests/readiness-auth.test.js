import assert from 'node:assert/strict';
import test from 'node:test';
import {authorizeReadinessRequest} from '../netlify/functions/_readiness-auth.mjs';

function request(token=''){return new Request('https://mpr.example/api/internal/readiness',{headers:token?{authorization:`Bearer ${token}`}:{}});}

test('dedicated readiness probe token bypasses user-session lookup only on exact match',async()=>{
  let calls=0;
  const result=await authorizeReadinessRequest({
    request:request('probe-secret'),
    env:{MPR_READINESS_PROBE_TOKEN:'probe-secret'},
    supabaseUrl:'https://example.supabase.co',
    anonKey:'anon',
    fetchImpl:async()=>{calls+=1;throw new Error('should not be called');}
  });
  assert.equal(result.ok,true);
  assert.equal(result.principal,'READINESS_PROBE');
  assert.equal(calls,0);
});

test('wrong readiness probe token fails closed and cannot bypass Supabase auth',async()=>{
  let calls=0;
  const result=await authorizeReadinessRequest({
    request:request('wrong-secret'),
    env:{MPR_READINESS_PROBE_TOKEN:'probe-secret',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.ro'},
    supabaseUrl:'https://example.supabase.co',
    anonKey:'anon',
    fetchImpl:async()=>{calls+=1;return new Response(null,{status:401});}
  });
  assert.equal(result.ok,false);
  assert.equal(result.response.status,401);
  assert.equal(calls,1);
});

test('admin JWT path remains available when probe token does not match',async()=>{
  const result=await authorizeReadinessRequest({
    request:request('admin-jwt'),
    env:{MPR_READINESS_PROBE_TOKEN:'probe-secret',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.ro'},
    supabaseUrl:'https://example.supabase.co',
    anonKey:'anon',
    fetchImpl:async()=>Response.json({id:'u1',email:'admin@example.ro'})
  });
  assert.equal(result.ok,true);
  assert.equal(result.principal,'ADMIN_USER');
});

test('missing bearer credential is rejected',async()=>{
  const result=await authorizeReadinessRequest({request:request(),env:{MPR_READINESS_PROBE_TOKEN:'probe-secret'}});
  assert.equal(result.ok,false);
  assert.equal(result.response.status,401);
});
