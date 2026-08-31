import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createSandboxPreflightReadinessHandler} from '../netlify/functions/sandbox-preflight-readiness.mjs';

const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',STRIPE_SECRET_KEY:'sk_test_demo',MPR_READINESS_PROBE_TOKEN:'probe-token'};
function request(){return new Request('https://mpr.example/api/internal/sandbox-preflight-readiness',{headers:{authorization:'Bearer probe-token'}});}
function mockFetch({workspacePlan='FREE',subscription=null,stripeSubscriptions=[],workspaceFound=true}={}){return async url=>{const value=String(url);if(value.includes('/rest/v1/workspaces')){assert.match(value,/slug=eq\.mpr-billing-sandbox/);return Response.json(workspaceFound?[{id:'ws-private',plan:workspacePlan}]:[]);}if(value.includes('/rest/v1/subscriptions'))return Response.json(subscription?[subscription]:[]);if(value.startsWith('https://api.stripe.com/v1/subscriptions'))return Response.json({data:stripeSubscriptions});return new Response(null,{status:404});};}

test('sandbox preflight readiness resolves reserved slug and returns clean booleans without identity leakage',async()=>{
  const handler=createSandboxPreflightReadinessHandler({env,fetch:mockFetch()});
  const response=await handler(request());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ready,true);
  assert.equal(body.checks.workspaceFree,true);
  assert.equal(body.checks.zeroActiveSubscriptions,true);
  const serialized=JSON.stringify(body);
  assert.equal(serialized.includes('ws-private'),false);
  assert.equal(serialized.includes('mpr-billing-sandbox'),false);
  assert.equal(serialized.includes('provider_customer_id'),false);
});

test('active Stripe subscription keeps sandbox workspace preflight blocked',async()=>{
  const subscription={plan:'FREE',status:'canceled',provider_customer_id:'cus_private',provider_subscription_id:'sub_old',cancel_at_period_end:false,last_stripe_event_id:'evt_old'};
  const handler=createSandboxPreflightReadinessHandler({env,fetch:mockFetch({subscription,stripeSubscriptions:[{id:'sub_live',status:'active'}]})});
  const response=await handler(request());
  const body=await response.json();
  assert.equal(body.ready,false);
  assert.equal(body.checks.zeroActiveSubscriptions,false);
  assert.equal(JSON.stringify(body).includes('cus_private'),false);
  assert.equal(JSON.stringify(body).includes('sub_live'),false);
});

test('missing reserved sandbox workspace fails closed without exposing slug',async()=>{
  const handler=createSandboxPreflightReadinessHandler({env,fetch:mockFetch({workspaceFound:false})});
  const body=await (await handler(request())).json();
  assert.equal(body.ready,false);
  assert.equal(body.configured,true);
  assert.equal(body.reason,'SANDBOX_WORKSPACE_NOT_FOUND');
  assert.equal(JSON.stringify(body).includes('mpr-billing-sandbox'),false);
});

test('explicit workspace id remains a backward-compatible server-only override',async()=>{
  const explicitEnv={...env,MPR_SANDBOX_WORKSPACE_ID:'ws-private'};
  const fetchImpl=async url=>{const value=String(url);if(value.includes('/rest/v1/workspaces')){assert.match(value,/id=eq\.ws-private/);return Response.json([{id:'ws-private',plan:'FREE'}]);}if(value.includes('/rest/v1/subscriptions'))return Response.json([]);return new Response(null,{status:404});};
  const body=await (await createSandboxPreflightReadinessHandler({env:explicitEnv,fetch:fetchImpl})(request())).json();
  assert.equal(body.ready,true);
});

test('release readiness UI consumes safe sandbox preflight endpoint and never requests workspace id from browser',async()=>{
  const js=await readFile('deployment-readiness.js','utf8');
  const html=await readFile('deployment-readiness.html','utf8');
  assert.match(js,/\/api\/internal\/sandbox-preflight-readiness/);
  assert.doesNotMatch(js,/MPR_SANDBOX_WORKSPACE_ID|x-mpr-workspace-id/);
  assert.match(html,/Sandbox workspace preflight/);
  assert.match(html,/ID-ul workspace-ului și identitatea Stripe nu sunt afișate/);
});
