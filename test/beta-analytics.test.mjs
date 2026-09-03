import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregate,aggregateFreeDemand,createBetaAnalyticsHandler} from '../netlify/functions/beta-analytics.mjs';

test('anonymous Free analytics measures niche and signup demand without claiming persistent unique users',()=>{
  const data=aggregateFreeDemand([
    {page_session_id:'landing-1',event_name:'FREE_LANDING_VIEW',acquisition_source:'tiktok'},
    {page_session_id:'landing-1',event_name:'FREE_TOP25_CTA_CLICK',acquisition_source:'tiktok'},
    {page_session_id:'top25-1',event_name:'FREE_TOP25_VIEW',acquisition_source:'tiktok'},
    {page_session_id:'top25-1',event_name:'FREE_NICHE_SELECTED',niche_id:'AUTO',acquisition_source:'tiktok'},
    {page_session_id:'top25-1',event_name:'FREE_PRODUCT_OPENED',niche_id:'AUTO',acquisition_source:'tiktok'},
    {page_session_id:'top25-1',event_name:'FREE_DECISION_REACHED',niche_id:'AUTO',acquisition_source:'tiktok',metadata:{decision:'SHORTLIST_ADD',target:'PLATFORM:AMAZON_ARCHIVE'}},
    {page_session_id:'top25-1',event_name:'FREE_PRODUCT_OPENED',niche_id:'AUTO',acquisition_source:'tiktok',metadata:{target:'COMPARE'}},
    {page_session_id:'top25-1',event_name:'FREE_DECISION_REACHED',niche_id:'AUTO',acquisition_source:'tiktok',metadata:{decision:'REQUEST_PLATFORM',target:'PLATFORM:EBAY'}},
    {page_session_id:'top25-1',event_name:'FREE_DECISION_REACHED',niche_id:'AUTO',acquisition_source:'tiktok',metadata:{decision:'INVESTIGATE'}},
    {page_session_id:'top25-1',event_name:'FREE_SIGNUP_CTA_CLICK',niche_id:'AUTO',acquisition_source:'tiktok'}
  ]);
  assert.equal(data.totals.sessions,2);
  assert.equal(data.totals.top25ViewSessions,1);
  assert.equal(data.conversion.productFromTop25,100);
  assert.equal(data.conversion.shortlistFromTop25,100);
  assert.equal(data.conversion.compareFromTop25,100);
  assert.equal(data.totals.decisionSessions,1);
  assert.equal(data.totals.platformRequestSessions,1);
  assert.equal(data.conversion.signupFromTop25,100);
  assert.deepEqual(data.requestedPlatforms[0],{label:'EBAY',count:1});
  assert.deepEqual(data.topNiches[0],{label:'AUTO',count:7});
  assert.deepEqual(data.acquisitionSources[0],{label:'tiktok',count:10});
});

test('beta analytics separates usage, billing, retention and churn without double counting workspaces',()=>{
  const data=aggregate({events:[
    {workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_VIEW'},{workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'ONBOARDING_COMPLETED'},{workspace_id:'w1',user_id:'u1',event_name:'HOME_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'DISCOVER_VIEW'},{workspace_id:'w1',user_id:'u1',event_name:'RADAR_VIEW'},
    {workspace_id:'w1',user_id:'u1',event_name:'UPGRADE_INTENT_RADAR'},{workspace_id:'w1',user_id:'u1',event_name:'CHECKOUT_STARTED'},
    {workspace_id:'w1',user_id:'u1',event_name:'CHECKOUT_COMPLETED'},{workspace_id:'w1',user_id:'u1',event_name:'PLAN_CHANGED'},
    {workspace_id:'w1',user_id:'u1',event_name:'SUBSCRIPTION_CANCEL_SCHEDULED'},{workspace_id:'w2',user_id:'u2',event_name:'SUBSCRIPTION_ENDED'}
  ],workspaces:[{id:'w1',plan:'LAUNCH'},{id:'w2',plan:'FREE'}],preferences:[{workspace_id:'w1',onboarding_completed:true}],subscriptions:[{workspace_id:'w1',plan:'LAUNCH',status:'active',cancel_at_period_end:true}]},30);
  assert.equal(data.totals.activeWorkspaces,2);
  assert.equal(data.usageFunnel.find(x=>x.key==='radar').workspaces,1);
  assert.equal(data.billingFunnel.find(x=>x.key==='paid').workspaces,1);
  assert.equal(data.billingFunnel.find(x=>x.key==='checkout_started').conversionFromPrevious,100);
  assert.equal(data.totals.cancelPendingWorkspaces,1);
  assert.equal(data.totals.endedWorkspaces,1);
  assert.equal(data.retention.activePaid,1);
  assert.equal(data.retention.cancelPending,1);
  assert.equal(data.retention.retainedPaid,0);
  assert.equal(data.retention.retentionRate,0);
  assert.equal(data.eventCounts.SUBSCRIPTION_ENDED,1);
  assert.equal(data.dataScope,'REAL_EVENT_DATA');
});

test('beta analytics marks conversion unavailable instead of zero when previous billing stage has no workspaces',()=>{
  const data=aggregate({events:[
    {workspace_id:'w1',user_id:'u1',event_name:'CHECKOUT_STARTED'},
    {workspace_id:'w1',user_id:'u1',event_name:'CHECKOUT_COMPLETED'}
  ],workspaces:[{id:'w1',plan:'DISCOVER'}],preferences:[],subscriptions:[]},30);
  const started=data.billingFunnel.find(x=>x.key==='checkout_started');
  const completed=data.billingFunnel.find(x=>x.key==='checkout_completed');
  assert.equal(started.workspaces,1);
  assert.equal(started.conversionFromPrevious,null);
  assert.equal(completed.conversionFromPrevious,100);
});

test('beta analytics conversions and retention are zero-safe',()=>{
  const data=aggregate({events:[],workspaces:[],preferences:[],subscriptions:[]},30);
  assert.equal(data.totals.events,0);
  assert.equal(data.conversion.onboarding,0);
  assert.equal(data.retention.retentionRate,0);
  assert.equal(data.retention.churnRate,0);
  assert.equal(data.usageFunnel[1].conversionFromPrevious,null);
  assert.equal(data.billingFunnel[1].conversionFromPrevious,null);
});

test('beta analytics rejects users outside server-side admin registry before cross-workspace reads',async()=>{
  let calls=0;const fetchImpl=async url=>{calls++;if(String(url).includes('/auth/v1/user'))return Response.json({id:'u1',email:'user@example.com'});if(String(url).includes('/beta_analytics_admins?'))return Response.json([]);throw new Error('cross-workspace query should not run');};
  const handler=createBetaAnalyticsHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}});const r=await handler(new Request('https://radar.example/api/internal/beta-analytics',{headers:{authorization:'Bearer token'}}));assert.equal(r.status,403);assert.equal(calls,2);
});

test('beta analytics accepts a registered admin and uses service role only server-side',async()=>{
  const fetchImpl=async url=>{const s=String(url);if(s.includes('/auth/v1/user'))return Response.json({id:'admin-1',email:'admin@example.com'});if(s.includes('/beta_analytics_admins?'))return Response.json([{user_id:'admin-1'}]);if(s.includes('/journey_events?')||s.includes('/workspaces?')||s.includes('/seller_preferences?')||s.includes('/subscriptions?'))return Response.json([]);return new Response('not found',{status:404});};
  const handler=createBetaAnalyticsHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}});const r=await handler(new Request('https://radar.example/api/internal/beta-analytics',{headers:{authorization:'Bearer token'}}));assert.equal(r.status,200);const body=await r.json();assert.equal(body.ok,true);assert.equal(body.totals.events,0);assert.ok(Array.isArray(body.usageFunnel));assert.ok(Array.isArray(body.billingFunnel));
});
