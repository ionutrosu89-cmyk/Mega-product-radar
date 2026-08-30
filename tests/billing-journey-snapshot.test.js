import assert from 'node:assert/strict';
import test from 'node:test';
import {buildBillingJourneySnapshot,createBillingJourneySnapshotHandler} from '../netlify/functions/billing-journey-snapshot.mjs';

function request(headers={}){return new Request('https://mpr.example/api/internal/billing-journey-snapshot',{headers});}

function sequenceFetch(responses){
  let index=0;
  return async()=>{
    const next=responses[index++];
    if(!next)throw new Error('Unexpected fetch');
    return new Response(JSON.stringify(next.body),{status:next.status??200,headers:{'content-type':'application/json'}});
  };
}

test('snapshot exposes operational evidence but no Stripe customer identity',()=>{
  const checkpoint=buildBillingJourneySnapshot({
    workspaceId:'workspace-1',
    workspace:{plan:'RADAR'},
    subscription:{status:'active',provider_customer_id:'cus_secretish',provider_subscription_id:'sub_1',cancel_at_period_end:false,last_stripe_event_id:'evt_2'},
    stripeSubscriptions:[{id:'sub_1',status:'active'},{id:'sub_old',status:'canceled'}],
    observedAt:'2026-08-30T20:00:00.000Z'
  });
  assert.equal(checkpoint.workspacePlan,'RADAR');
  assert.equal(checkpoint.activeSubscriptionCount,1);
  assert.equal(checkpoint.providerSubscriptionId,'sub_1');
  assert.equal(checkpoint.lastStripeEventId,'evt_2');
  assert.equal(JSON.stringify(checkpoint).includes('cus_secretish'),false);
});

test('duplicate active Stripe subscriptions are visible to the acceptance evidence',()=>{
  const checkpoint=buildBillingJourneySnapshot({
    workspaceId:'workspace-1',workspace:{plan:'DISCOVER'},subscription:{status:'active',provider_subscription_id:'sub_1'},
    stripeSubscriptions:[{status:'active'},{status:'trialing'},{status:'canceled'}]
  });
  assert.equal(checkpoint.activeSubscriptionCount,2);
});

test('FREE baseline without subscription produces zero active subscriptions',()=>{
  const checkpoint=buildBillingJourneySnapshot({workspaceId:'workspace-free',workspace:{plan:'FREE'},subscription:null,stripeSubscriptions:[],observedAt:'2026-08-30T20:00:00Z'});
  assert.equal(checkpoint.subscriptionStatus,'none');
  assert.equal(checkpoint.activeSubscriptionCount,0);
  assert.equal(checkpoint.providerSubscriptionId,'');
});

test('endpoint rejects live Stripe mode before querying workspace state',async()=>{
  const handler=createBillingJourneySnapshotHandler({env:{MPR_READINESS_PROBE_TOKEN:'probe-token',STRIPE_SECRET_KEY:'sk_live_example',SUPABASE_URL:'https://supabase.example',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'},fetch:async()=>{throw new Error('fetch should not run');}});
  const response=await handler(request({authorization:'Bearer probe-token','x-mpr-workspace-id':'workspace-1'}));
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,'SANDBOX_ONLY');
});

test('endpoint proves active subscription count from Stripe and returns safe checkpoint',async()=>{
  const fetchImpl=sequenceFetch([
    {body:[{id:'workspace-1',plan:'LAUNCH'}]},
    {body:[{plan:'LAUNCH',status:'active',provider_customer_id:'cus_1',provider_subscription_id:'sub_1',cancel_at_period_end:true,last_stripe_event_id:'evt_cancel'}]},
    {body:{data:[{id:'sub_1',status:'active'},{id:'sub_old',status:'canceled'}]}}
  ]);
  const handler=createBillingJourneySnapshotHandler({env:{MPR_READINESS_PROBE_TOKEN:'probe-token',STRIPE_SECRET_KEY:'sk_test_example',SUPABASE_URL:'https://supabase.example',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'},fetch:fetchImpl,now:()=>new Date('2026-08-30T20:00:00Z')});
  const response=await handler(request({authorization:'Bearer probe-token','x-mpr-workspace-id':'workspace-1'}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.checkpoint.activeSubscriptionCount,1);
  assert.equal(body.checkpoint.cancelAtPeriodEnd,true);
  assert.equal(JSON.stringify(body).includes('cus_1'),false);
});
