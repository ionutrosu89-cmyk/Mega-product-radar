import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregate,createBetaAnalyticsHandler} from '../netlify/functions/beta-analytics.mjs';

test('beta analytics aggregates distinct workspace funnel without double counting events',()=>{
  const data=aggregate({events:[
    {workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_VIEW'},{workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_COMPLETED'},{workspace_id:'w1',user_id:'u1',event_name:'HOME_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'HOME_OPEN_DISCOVER'},{workspace_id:'w1',user_id:'u1',event_name:'UPGRADE_INTENT_RADAR'},
    {workspace_id:'w2',user_id:'u2',event_name:'ONBOARDING_VIEW'}
  ],workspaces:[{id:'w1',plan:'DISCOVER'},{id:'w2',plan:'FREE'}],preferences:[{workspace_id:'w1',onboarding_completed:true}],subscriptions:[]},30);
  assert.equal(data.totals.activeWorkspaces,2);
  assert.equal(data.totals.onboardingCompleted,1);
  assert.equal(data.funnel.find(x=>x.key==='onboarding_view').workspaces,2);
  assert.equal(data.funnel.find(x=>x.key==='discover').workspaces,1);
  assert.equal(data.byPlan.DISCOVER,1);
  assert.equal(data.totals.upgradeIntentWorkspaces,1);
});

test('beta analytics rejects users outside admin allowlist before service-role reads',async()=>{
  let calls=0;
  const fetchImpl=async url=>{calls++;if(String(url).includes('/auth/v1/user'))return Response.json({email:'user@example.com'});throw new Error('service query should not run');};
  const handler=createBetaAnalyticsHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',BETA_ANALYTICS_ADMIN_EMAILS:'admin@example.com'}});
  const r=await handler(new Request('https://radar.example/api/internal/beta-analytics',{headers:{authorization:'Bearer token'}}));
  assert.equal(r.status,403);assert.equal(calls,1);
});

test('beta analytics stays disabled when admin allowlist is missing',async()=>{
  const handler=createBetaAnalyticsHandler({fetch:async()=>Response.json({email:'admin@example.com'}),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}});
  const r=await handler(new Request('https://radar.example/api/internal/beta-analytics',{headers:{authorization:'Bearer token'}}));
  assert.equal(r.status,503);
});
