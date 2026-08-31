import assert from 'node:assert/strict';
import test from 'node:test';
import {createBillingE2eAcceptanceHandler} from '../netlify/functions/billing-e2e-acceptance.mjs';

const workspaceId='11111111-1111-4111-8111-111111111111';
const deploymentRef='abcdef1234567890';
const probe='readiness-probe-secret';
const baseEnv={
  SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',
  MPR_READINESS_PROBE_TOKEN:probe,MPR_SANDBOX_WORKSPACE_ID:workspaceId,COMMIT_REF:deploymentRef,
  STRIPE_SECRET_KEY:'sk_test_123',STRIPE_WEBHOOK_SECRET:'whsec_test',
  STRIPE_PRICE_DISCOVER:'price_d',STRIPE_PRICE_RADAR:'price_r',STRIPE_PRICE_LAUNCH:'price_l'
};

function validPrice(id){const amounts={price_d:1790,price_r:2900,price_l:8900};return {active:true,currency:'eur',unit_amount:amounts[id],recurring:{interval:'month'}};}
function runtimeReady(){return [{ready:true,subscriptions_table:true,webhook_events_table:true,ordering_created_column:true,ordering_event_id_column:true,webhook_status_column:true,webhook_error_column:true,atomic_apply_rpc:true}];}

function baselineFetch(){
  const seen=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);seen.push(value);
    if(value.includes('/rest/v1/billing_e2e_acceptance_runs?select='))return Response.json([]);
    if(value.includes('api.stripe.com/v1/prices/'))return Response.json(validPrice(decodeURIComponent(value.split('/').pop())));
    if(value.includes('/rest/v1/rpc/mpr_billing_runtime_readiness'))return Response.json(runtimeReady());
    if(value.includes('/rest/v1/workspaces?'))return Response.json([{id:workspaceId,plan:'FREE'}]);
    if(value.includes('/rest/v1/subscriptions?'))return Response.json([]);
    if(value.endsWith('/rest/v1/billing_e2e_acceptance_runs')&&options.method==='POST'){
      const body=JSON.parse(options.body);
      return Response.json([{id:'run-1',...body,updated_at:body.updated_at}]);
    }
    return Response.json({error:'unexpected '+value},{status:500});
  };
  return {fetchImpl,seen};
}

test('FREE baseline is captured server-side only after sandbox billing and runtime preflight',async()=>{
  const {fetchImpl,seen}=baselineFetch();
  const handler=createBillingE2eAcceptanceHandler({fetch:fetchImpl,env:baseEnv,now:()=>new Date('2026-08-31T05:30:00Z')});
  const response=await handler(new Request('https://mpr.example/api/internal/billing-e2e-acceptance',{method:'POST',headers:{authorization:`Bearer ${probe}`,'content-type':'application/json'},body:JSON.stringify({stage:'FREE_BASELINE'})}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);
  assert.equal(body.checkpointCount,1);
  assert.equal(body.nextStage,'DISCOVER_ACTIVE');
  assert.equal(body.deploymentBound,true);
  assert.equal(JSON.stringify(body).includes(workspaceId),false);
  assert.ok(seen.some(url=>url.includes(`deployment_ref=eq.${deploymentRef}`)));
  assert.ok(seen.some(url=>url.includes('/rpc/mpr_billing_runtime_readiness')));
  assert.ok(seen.filter(url=>url.includes('api.stripe.com/v1/prices/')).length===3);
});

test('acceptance refuses to start without a deployed release identity',async()=>{
  const {COMMIT_REF,...env}=baseEnv;
  const handler=createBillingE2eAcceptanceHandler({fetch:async()=>Response.json([]),env});
  const response=await handler(new Request('https://mpr.example/api/internal/billing-e2e-acceptance',{headers:{authorization:`Bearer ${probe}`}}));
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,'DEPLOYMENT_REF_NOT_CONFIGURED');
});

test('LIVE Stripe mode cannot create a sandbox baseline ledger',async()=>{
  const {fetchImpl}=baselineFetch();
  const handler=createBillingE2eAcceptanceHandler({fetch:fetchImpl,env:{...baseEnv,STRIPE_SECRET_KEY:'sk_live_123'}});
  const response=await handler(new Request('https://mpr.example/api/internal/billing-e2e-acceptance',{method:'POST',headers:{authorization:`Bearer ${probe}`,'content-type':'application/json'},body:JSON.stringify({stage:'FREE_BASELINE'})}));
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,'BILLING_PREFLIGHT_NOT_READY');
});

test('acceptance ledger migration is deployment-scoped and service-role only',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile('supabase/migrations/20260831_billing_e2e_acceptance.sql','utf8'));
  assert.match(source,/deployment_ref text not null/i);
  assert.match(source,/unique\(environment,workspace_id,deployment_ref\)/i);
  assert.match(source,/enable row level security/i);
  assert.match(source,/revoke all on table public\.billing_e2e_acceptance_runs from public, anon, authenticated/i);
  assert.match(source,/grant select, insert, update, delete on table public\.billing_e2e_acceptance_runs to service_role/i);
});
