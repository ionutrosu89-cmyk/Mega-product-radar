import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createPaidBetaRuntimeReadinessHandler,normalizeRuntime} from '../netlify/functions/paid-beta-runtime-readiness.mjs';

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.ro'};
const request=()=>new Request('https://mpr.example/api/internal/paid-beta-runtime-readiness',{headers:{authorization:'Bearer token'}});
const readyRow={ready:true,subscriptions_table:true,webhook_events_table:true,ordering_created_column:true,ordering_event_id_column:true,webhook_status_column:true,webhook_error_column:true,atomic_apply_rpc:true};

function fetchRuntime(runtimeResponse){return async url=>{const value=String(url);if(value.includes('/auth/v1/user'))return Response.json({id:'u1',email:'admin@example.ro'});if(value.includes('/rest/v1/rpc/mpr_billing_runtime_readiness'))return runtimeResponse();return new Response(null,{status:404});};}

test('normalizes database readiness without exposing database values',()=>{
  const state=normalizeRuntime([readyRow]);
  assert.equal(state.ready,true);
  assert.equal(state.checks.atomicApplyRpc,true);
  assert.deepEqual(Object.keys(state).sort(),['checks','ready']);
});

test('paid beta runtime readiness passes only when database probe is ready',async()=>{
  const handler=createPaidBetaRuntimeReadinessHandler({fetch:fetchRuntime(()=>Response.json([readyRow])),env});
  const response=await handler(request());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ready,true);
  assert.equal(body.checks.runtimeProbeAvailable,true);
  assert.equal(body.checks.atomicApplyRpc,true);
});

test('missing runtime migration fails closed instead of producing sandbox GO',async()=>{
  const handler=createPaidBetaRuntimeReadinessHandler({fetch:fetchRuntime(()=>new Response(JSON.stringify({message:'function not found'}),{status:404,headers:{'content-type':'application/json'}})),env});
  const response=await handler(request());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ready,false);
  assert.equal(body.reason,'BILLING_RUNTIME_PROBE_UNAVAILABLE');
  assert.equal(body.checks.runtimeProbeAvailable,false);
});

test('runtime readiness is admin-only',async()=>{
  const handler=createPaidBetaRuntimeReadinessHandler({fetch:async url=>String(url).includes('/auth/v1/user')?Response.json({id:'u1',email:'other@example.ro'}):new Response(null,{status:404}),env});
  const response=await handler(request());
  assert.equal(response.status,403);
});

test('runtime migration is read-only, invoker-security and service-role-only',async()=>{
  const sql=await readFile('supabase/migrations/20260830_paid_beta_runtime_readiness.sql','utf8');
  assert.match(sql,/mpr_billing_runtime_readiness/);
  assert.match(sql,/pg_catalog\.to_regclass\('public\.subscriptions'\)/);
  assert.match(sql,/pg_catalog\.to_regclass\('public\.billing_webhook_events'\)/);
  assert.match(sql,/pg_catalog\.to_regprocedure\('public\.apply_stripe_subscription_event\(uuid,text,text,text,text,timestamp with time zone,boolean,bigint,text\)'\)/);
  assert.match(sql,/security invoker/i);
  assert.doesNotMatch(sql,/security definer/i);
  assert.match(sql,/set search_path=pg_catalog,public/i);
  assert.match(sql,/revoke execute .* from public,anon,authenticated/i);
  assert.match(sql,/grant execute .* to service_role/i);
  assert.doesNotMatch(sql,/insert into/i);
  assert.doesNotMatch(sql,/update public\./i);
  assert.doesNotMatch(sql,/delete from/i);
});

test('atomic Stripe entitlement RPC is invoker-security and service-role-only',async()=>{
  const sql=await readFile('supabase/migrations/20260830_stripe_webhook_ordering.sql','utf8');
  assert.match(sql,/apply_stripe_subscription_event/);
  assert.match(sql,/security invoker/i);
  assert.doesNotMatch(sql,/security definer/i);
  assert.match(sql,/set search_path=pg_catalog,public/i);
  assert.match(sql,/revoke execute .* from public,anon,authenticated/i);
  assert.match(sql,/grant execute .* to service_role/i);
});
