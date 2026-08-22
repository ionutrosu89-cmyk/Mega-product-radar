import {SAAS_CONFIG} from '../../saas-config.js';

const PLAN_CODES=['FREE','DISCOVER','RADAR','LAUNCH'];
const normalizePlan=v=>PLAN_CODES.includes(String(v||'').toUpperCase())?String(v).toUpperCase():'FREE';
const unique=(rows,key)=>new Set(rows.map(x=>x?.[key]).filter(Boolean));
const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:null;
const safePct=(a,b)=>pct(a,b)??0;

async function jsonFetch(url,headers,fetchImpl){const r=await fetchImpl(url,{headers});if(!r.ok)throw new Error(`Analytics source failed: ${r.status}`);return r.json();}

function withStageRates(stages){
  return stages.map((stage,index)=>({...stage,conversionFromPrevious:index===0?null:pct(stage.workspaces,stages[index-1].workspaces)}));
}

function aggregate({events=[],workspaces=[],preferences=[],subscriptions=[]},days){
  const byPlan=Object.fromEntries(PLAN_CODES.map(x=>[x,0]));for(const w of workspaces)byPlan[normalizePlan(w.plan)]++;
  const completedPrefs=preferences.filter(x=>x.onboarding_completed===true);
  const wsWith=name=>unique(events.filter(x=>x.event_name===name),'workspace_id');
  const wsPrefix=prefix=>unique(events.filter(x=>String(x.event_name||'').startsWith(prefix)),'workspace_id');

  const onboardingView=wsWith('ONBOARDING_VIEW');
  const onboardingComplete=new Set([...wsWith('ONBOARDING_COMPLETED'),...completedPrefs.map(x=>x.workspace_id).filter(Boolean)]);
  const home=wsWith('HOME_VIEW');
  const discover=new Set([...wsWith('DISCOVER_VIEW'),...wsWith('HOME_OPEN_DISCOVER')]);
  const radar=new Set([...wsWith('RADAR_VIEW'),...wsWith('HOME_OPEN_RADAR')]);
  const launch=new Set([...wsWith('LAUNCH_VIEW'),...wsWith('HOME_OPEN_LAUNCH')]);

  const upgradeIntent=new Set([...wsPrefix('UPGRADE_INTENT_'),...wsPrefix('HOME_UPGRADE_')]);
  const checkoutStarted=wsWith('CHECKOUT_STARTED');
  const checkoutCompleted=wsWith('CHECKOUT_COMPLETED');
  const subscriptionActivated=wsWith('SUBSCRIPTION_ACTIVATED');
  const planChanged=wsWith('PLAN_CHANGED');
  const cancelScheduled=wsWith('SUBSCRIPTION_CANCEL_SCHEDULED');
  const cancelUnscheduled=wsWith('SUBSCRIPTION_CANCEL_UNSCHEDULED');
  const ended=wsWith('SUBSCRIPTION_ENDED');

  const activeSubscriptions=subscriptions.filter(x=>['active','trialing'].includes(String(x.status||'').toLowerCase()));
  const activePaid=new Set(activeSubscriptions.map(x=>x.workspace_id).filter(Boolean));
  const cancelPending=new Set(activeSubscriptions.filter(x=>x.cancel_at_period_end===true).map(x=>x.workspace_id).filter(Boolean));
  const retainedPaid=new Set([...activePaid].filter(id=>!cancelPending.has(id)));
  const activeWs=unique(events,'workspace_id');
  const activeUsers=unique(events,'user_id');
  const eventCounts={};for(const e of events)eventCounts[e.event_name]=(eventCounts[e.event_name]||0)+1;

  const usageFunnel=withStageRates([
    {key:'onboarding_view',label:'Onboarding văzut',workspaces:onboardingView.size},
    {key:'onboarding_complete',label:'Onboarding completat',workspaces:onboardingComplete.size},
    {key:'home',label:'Home activat',workspaces:home.size},
    {key:'discover',label:'Discover folosit',workspaces:discover.size},
    {key:'radar',label:'Radar folosit',workspaces:radar.size},
    {key:'launch',label:'Launch folosit',workspaces:launch.size}
  ]);

  const billingFunnel=withStageRates([
    {key:'upgrade_intent',label:'Upgrade intent',workspaces:upgradeIntent.size},
    {key:'checkout_started',label:'Checkout pornit',workspaces:checkoutStarted.size},
    {key:'checkout_completed',label:'Checkout finalizat',workspaces:checkoutCompleted.size},
    {key:'paid',label:'Abonament activ',workspaces:activePaid.size}
  ]);

  const retention={
    activePaid:activePaid.size,
    cancelPending:cancelPending.size,
    retainedPaid:retainedPaid.size,
    endedInWindow:ended.size,
    retentionRate:safePct(retainedPaid.size,activePaid.size),
    cancelPendingRate:safePct(cancelPending.size,activePaid.size),
    churnRate:safePct(ended.size,Math.max(1,subscriptionActivated.size))
  };

  const legacyFunnel=[...usageFunnel,...billingFunnel.filter(x=>x.key!=='upgrade_intent')];
  return {
    days,
    generatedAt:new Date().toISOString(),
    dataScope:'REAL_EVENT_DATA',
    totals:{
      workspaces:workspaces.length,
      activeWorkspaces:activeWs.size,
      activeUsers:activeUsers.size,
      events:events.length,
      onboardingCompleted:onboardingComplete.size,
      upgradeIntentWorkspaces:upgradeIntent.size,
      checkoutStartedWorkspaces:checkoutStarted.size,
      checkoutCompletedWorkspaces:checkoutCompleted.size,
      subscriptionActivatedWorkspaces:subscriptionActivated.size,
      planChangedWorkspaces:planChanged.size,
      activePaidWorkspaces:activePaid.size,
      cancelPendingWorkspaces:cancelPending.size,
      cancelScheduledWorkspaces:cancelScheduled.size,
      cancelUnscheduledWorkspaces:cancelUnscheduled.size,
      endedWorkspaces:ended.size,
      retainedPaidWorkspaces:retainedPaid.size
    },
    byPlan,
    usageFunnel,
    billingFunnel,
    funnel:legacyFunnel,
    eventCounts,
    retention,
    conversion:{
      onboarding:safePct(onboardingComplete.size,onboardingView.size),
      activation:safePct(home.size,onboardingComplete.size),
      discoverToRadar:safePct(radar.size,discover.size),
      radarToLaunch:safePct(launch.size,radar.size),
      upgradeIntentFromActive:safePct(upgradeIntent.size,activeWs.size),
      checkoutFromUpgrade:safePct(checkoutStarted.size,upgradeIntent.size),
      checkoutCompletion:safePct(checkoutCompleted.size,checkoutStarted.size),
      paidFromCheckout:safePct(activePaid.size,checkoutCompleted.size),
      paidFromActive:safePct(activePaid.size,activeWs.size)
    },
    definitions:{
      usage:'Etapele de utilizare măsoară modulele folosite și pot fi sărite fără ca billing-ul să fie invalid.',
      billing:'Etapele de billing sunt calculate separat. Când etapa precedentă are 0 workspace-uri, conversia este indisponibilă, nu 0%.',
      retention:'Cancel pending rămâne abonament activ. Churn apare doar după SUBSCRIPTION_ENDED confirmat de Stripe.'
    }
  };
}

async function isAnalyticsAdmin(user,{supabaseUrl,service,fetchImpl,env}){const h={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};const rows=await jsonFetch(`${supabaseUrl}/rest/v1/beta_analytics_admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,h,fetchImpl).catch(()=>[]);if(Array.isArray(rows)&&rows.length)return true;const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);return allowed.includes(String(user?.email||'').toLowerCase());}

export function createBetaAnalyticsHandler({fetch:fetchImpl=fetch,env=process.env}={}){return async request=>{try{const auth=request.headers.get('authorization')||'';if(!/^Bearer\s+\S+/i.test(auth))return Response.json({ok:false,error:'Authentication required'},{status:401});const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;const user=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{apikey:anon,authorization:auth},fetchImpl);const service=env.SUPABASE_SERVICE_ROLE_KEY;if(!service)return Response.json({ok:false,error:'Supabase service role is not configured'},{status:503});if(!await isAnalyticsAdmin(user,{supabaseUrl,service,fetchImpl,env}))return Response.json({ok:false,error:'Admin access required'},{status:403});const url=new URL(request.url),days=Math.min(90,Math.max(1,Number(url.searchParams.get('days')||30)||30));const since=new Date(Date.now()-days*86400000).toISOString();const h={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};const [events,workspaces,preferences,subscriptions]=await Promise.all([jsonFetch(`${supabaseUrl}/rest/v1/journey_events?select=workspace_id,user_id,event_name,plan,page,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=5000`,h,fetchImpl),jsonFetch(`${supabaseUrl}/rest/v1/workspaces?select=id,plan,created_at&limit=2000`,h,fetchImpl),jsonFetch(`${supabaseUrl}/rest/v1/seller_preferences?select=workspace_id,onboarding_completed,experience_level,goal,monthly_budget_ron&limit=2000`,h,fetchImpl),jsonFetch(`${supabaseUrl}/rest/v1/subscriptions?select=workspace_id,plan,status,current_period_end,cancel_at_period_end&limit=2000`,h,fetchImpl).catch(()=>[])]);return Response.json({ok:true,...aggregate({events,workspaces,preferences,subscriptions},days)},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}};}

export {aggregate,isAnalyticsAdmin};
export default createBetaAnalyticsHandler();
export const config={path:'/api/internal/beta-analytics',method:'GET'};
