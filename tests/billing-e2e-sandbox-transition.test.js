import test from 'node:test';
import assert from 'node:assert/strict';
import {createBillingE2eSandboxTransitionHandler} from '../netlify/functions/billing-e2e-sandbox-transition.mjs';

const workspaceId='11111111-1111-4111-8111-111111111111';
const deploymentRef='1234567890abcdef1234567890abcdef12345678';
const baseEnv={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',STRIPE_SECRET_KEY:'sk_test_123',STRIPE_PRICE_DISCOVER:'price_d',STRIPE_PRICE_RADAR:'price_r',STRIPE_PRICE_LAUNCH:'price_l',MPR_SANDBOX_WORKSPACE_ID:workspaceId};
const oidc=async()=>({ok:true,principal:'GITHUB_ACTIONS_OIDC'});

function request(stage='DISCOVER_ACTIVE'){return new Request('https://mpr.example/api/internal/billing-e2e-sandbox-transition',{method:'POST',headers:{authorization:'Bearer oidc','content-type':'application/json','x-mpr-deployment-ref':deploymentRef},body:JSON.stringify({stage})});}

test('DISCOVER transition creates only a Stripe test subscription and does not write entitlement state directly',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);calls.push({value,options});
    if(value.includes('/rest/v1/workspaces?'))return Response.json([{id:workspaceId,plan:'FREE'}]);
    if(value.includes('/rest/v1/billing_e2e_acceptance_runs?'))return Response.json([{status:'IN_PROGRESS',checkpoint_count:1}]);
    if(value.includes('/rest/v1/subscriptions?'))return Response.json([]);
    if(value==='https://api.stripe.com/v1/customers')return Response.json({id:'cus_test'});
    if(value==='https://api.stripe.com/v1/subscriptions')return Response.json({id:'sub_test',status:'active'});
    return Response.json({error:'unexpected'},{status:500});
  };
  const handler=createBillingE2eSandboxTransitionHandler({fetch:fetchImpl,env:baseEnv,authorize:oidc});
  const response=await handler(request());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);assert.equal(body.realMoney,false);assert.equal(body.stripeMode,'SANDBOX');assert.equal(body.entitlementAuthority,'WEBHOOK_ONLY');
  assert.ok(calls.some(call=>call.value==='https://api.stripe.com/v1/subscriptions'));
  assert.equal(calls.some(call=>call.value.includes('/rest/v1/subscriptions')&&['POST','PATCH','DELETE'].includes(call.options.method)),false);
  const createSub=calls.find(call=>call.value==='https://api.stripe.com/v1/subscriptions');
  assert.match(String(createSub.options.body),/metadata%5Bworkspace_id%5D=/);
  assert.match(String(createSub.options.body),/metadata%5Bplan%5D=DISCOVER/);
});

test('transition endpoint rejects every non-OIDC principal before side effects',async()=>{
  let touched=false;
  const handler=createBillingE2eSandboxTransitionHandler({fetch:async()=>{touched=true;return Response.json({});},env:baseEnv,authorize:async()=>({ok:true,principal:'READINESS_PROBE'})});
  const response=await handler(request());
  assert.equal(response.status,403);assert.equal((await response.json()).code,'OIDC_REQUIRED');assert.equal(touched,false);
});

test('transition endpoint rejects live Stripe mode before provider calls',async()=>{
  let touched=false;
  const handler=createBillingE2eSandboxTransitionHandler({fetch:async()=>{touched=true;return Response.json({});},env:{...baseEnv,STRIPE_SECRET_KEY:'sk_live_123'},authorize:oidc});
  const response=await handler(request());
  assert.equal(response.status,409);assert.equal((await response.json()).code,'SANDBOX_ONLY');assert.equal(touched,false);
});

test('transition requires current deployment ledger stage in exact order',async()=>{
  const fetchImpl=async url=>{
    const value=String(url);
    if(value.includes('/rest/v1/workspaces?'))return Response.json([{id:workspaceId,plan:'FREE'}]);
    if(value.includes('/rest/v1/billing_e2e_acceptance_runs?'))return Response.json([{status:'IN_PROGRESS',checkpoint_count:2}]);
    return Response.json({error:'unexpected'},{status:500});
  };
  const handler=createBillingE2eSandboxTransitionHandler({fetch:fetchImpl,env:baseEnv,authorize:oidc});
  const response=await handler(request('DISCOVER_ACTIVE'));
  assert.equal(response.status,409);assert.equal((await response.json()).code,'STAGE_OUT_OF_ORDER');
});
