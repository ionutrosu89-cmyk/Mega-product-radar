import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregate,createBetaAnalyticsHandler} from '../netlify/functions/beta-analytics.mjs';

test('beta analytics aggregates distinct workspace funnel without double counting events',()=>{
  const data=aggregate({events:[
    {workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_VIEW'},{workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_COMPLETED'},{workspace_id:'w1',user_id:'u1',event_name:'HOME_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'DISCOVER_VIEW'},{workspace_id:'w1',user_id:'u1',event_name:'RADAR_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'UPGRADE_INTENT_RADAR'},{workspace_id:'w1',user_id:'u1',event_name:'CHECKOUT_STARTED'},
    {workspace_id:'w1',user_id:'u1',event_name:'CHECKOUT_COMPLETED'},{workspace_id:'w1',user_id:'u1',event_name:'PLAN_CHANGED'},
    {workspace_id:'w1',user_id:'u1',event_name:'PLAN_CHANGED'},{workspace_id:'w2',user_id:'u2',event_name:'ONBOARDING_VIEW'}
  ],workspaces:[{id:'w1',plan:'LAUNCH'},{id:'w2',plan:'FREE'}],preferences:[{workspace_id:'w1',onboarding_completed:true}],subscriptions:[{workspace_id:'w1',plan:'LAUNCH',status:'active'}]},30);
  assert.equal(data.totals.activeWorkspaces,2);
  assert.equal(data.totals.onboardingCompleted,1);
  assert.equal(data.funnel.find(x=>x.key==='onboarding_view').workspaces,2);
  assert.equal(data.funnel.find(x=>x.key==='discover').workspaces,1);
  assert.equal(data.funnel.find(x=>x.key==='radar').workspaces,1);
  assert.equal(data.funnel.find(x=>x.key==='checkout_started').workspaces,1);
  assert.equal(data.funnel.find(x=>x.key==='paid').workspaces,1);
  assert.equal(data.byPlan.LAUNCH,1);
  assert.equal(data.totals.upgradeIntentWorkspaces,1);
  assert.equal(data.totals.planChangedWorkspaces,1);
  assert.equal(data.eventCounts.PLAN_CHANGED,2);
  assert.equal(data.conversion.checkoutCompletion,100);
  assert.equal(data.dataScope,'REAL_EVENT_DATA');
});

test('beta analytics conversions are zero-safe and never fabricate percentages',()=>{
  const data=aggregate({events:[],workspaces:[],preferences:[],subscriptions:[]},30);
  assert.equal(data.totals.events,0);
  assert.equal(data.totals.planChangedWorkspaces,0);
  assert.equal(data.conversion.onboarding,0);
  assert.equal(data.conversion.checkoutFromUpgrade,0);
  assert.equal(data.conversion.paidFromCheckout,0);
});

test('beta analytics rejects users outside server-side admin registry before cross-workspace reads',async()=>{
  let calls=0;
  const fetchImpl=async url=>{
    calls++;
    if(String(url).includes('/auth/v1/user'))return Response.json({id:'u1',email:'user@example.com'});
    if(String(url).includes('/beta_analytics_admins?'))return Response.json([]);
    throw new Error('cross-workspace query should not run');
  };
  const handler=createBetaAnalyticsHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}});
  const r=await handler(new Request('https://radar.example/api/internal/beta-analytics',{headers:{authorization:'Bearer token'}}));
  assert.equal(r.status,403);assert.equal(calls,2);
});

test('beta analytics accepts a registered admin and uses service role only server-side',async()=>{
  const fetchImpl=async url=>{
    const s=String(url);
    if(s.includes('/auth/v1/user'))return Response.json({id:'admin-1',email:'admin@example.com'});
    if(s.includes('/beta_analytics_admins?'))return Response.json([{user_id:'admin-1'}]);
    if(s.includes('/journey_events?'))return Response.json([]);
    if(s.includes('/workspaces?'))return Response.json([]);
    if(s.includes('/seller_preferences?'))return Response.json([]);
    if(s.includes('/subscriptions?'))return Response.json([]);
    return new Response('not found',{status:404});
  };
  const handler=createBetaAnalyticsHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}});
  const r=await handler(new Request('https://radar.example/api/internal/beta-analytics',{headers:{authorization:'Bearer token'}}));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.ok,true);
  assert.equal(body.totals.events,0);
});
