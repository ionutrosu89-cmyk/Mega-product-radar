import {SAAS_CONFIG} from '../../saas-config.js';

const PLAN_CODES=['FREE','DISCOVER','RADAR','LAUNCH'];
const normalizePlan=v=>PLAN_CODES.includes(String(v||'').toUpperCase())?String(v).toUpperCase():'FREE';
const unique=(rows,key)=>new Set(rows.map(x=>x?.[key]).filter(Boolean));
const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:0;

async function jsonFetch(url,headers,fetchImpl){
  const r=await fetchImpl(url,{headers});
  if(!r.ok)throw new Error(`Analytics source failed: ${r.status}`);
  return r.json();
}

function aggregate({events=[],workspaces=[],preferences=[],subscriptions=[]},days){
  const byPlan=Object.fromEntries(PLAN_CODES.map(x=>[x,0]));
  for(const w of workspaces)byPlan[normalizePlan(w.plan)]++;
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
  const activeSubscriptions=subscriptions.filter(x=>['active','trialing'].includes(String(x.status||'').toLowerCase()));
  const activePaid=new Set(activeSubscriptions.map(x=>x.workspace_id).filter(Boolean));
  const activeWs=unique(events,'workspace_id');
  const activeUsers=unique(events,'user_id');
  const eventCounts={};for(const e of events)eventCounts[e.event_name]=(eventCounts[e.event_name]||0)+1;
  const funnel=[
    {key:'onboarding_view',label:'Onboarding văzut',workspaces:onboardingView.size},
    {key:'onboarding_complete',label:'Onboarding completat',workspaces:onboardingComplete.size},
    {key:'home',label:'Home activat',workspaces:home.size},
    {key:'discover',label:'Discover folosit',workspaces:discover.size},
    {key:'radar',label:'Radar folosit',workspaces:radar.size},
    {key:'launch',label:'Launch folosit',workspaces:launch.size}
  ];
  for(let i=0;i<funnel.length;i++)funnel[i].conversionFromPrevious=i===0?100:pct(funnel[i].workspaces,funnel[i-1].workspaces);
  return {days,generatedAt:new Date().toISOString(),totals:{workspaces:workspaces.length,activeWorkspaces:activeWs.size,activeUsers:activeUsers.size,events:events.length,onboardingCompleted:onboardingComplete.size,upgradeIntentWorkspaces:upgradeIntent.size,activePaidWorkspaces:activePaid.size},byPlan,funnel,eventCounts,conversion:{onboarding:pct(onboardingComplete.size,onboardingView.size),activation:pct(home.size,onboardingComplete.size),discoverToRadar:pct(radar.size,discover.size),radarToLaunch:pct(launch.size,radar.size),upgradeIntentFromActive:pct(upgradeIntent.size,activeWs.size),paidFromActive:pct(activePaid.size,activeWs.size)}};
}

export function createBetaAnalyticsHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const auth=request.headers.get('authorization')||'';
      if(!/^Bearer\s+\S+/i.test(auth))return Response.json({ok:false,error:'Authentication required'},{status:401});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const user=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{apikey:anon,authorization:auth},fetchImpl);
      const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if(!allowed.length)return Response.json({ok:false,error:'Beta analytics admin allowlist is not configured'},{status:503});
      if(!allowed.includes(String(user?.email||'').toLowerCase()))return Response.json({ok:false,error:'Admin access required'},{status:403});
      const service=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!service)return Response.json({ok:false,error:'Supabase service role is not configured'},{status:503});
      const url=new URL(request.url),days=Math.min(90,Math.max(1,Number(url.searchParams.get('days')||30)||30));
      const since=new Date(Date.now()-days*86400000).toISOString();
      const h={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
      const [events,workspaces,preferences,subscriptions]=await Promise.all([
        jsonFetch(`${supabaseUrl}/rest/v1/journey_events?select=workspace_id,user_id,event_name,plan,page,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=5000`,h,fetchImpl),
        jsonFetch(`${supabaseUrl}/rest/v1/workspaces?select=id,plan,created_at&limit=2000`,h,fetchImpl),
        jsonFetch(`${supabaseUrl}/rest/v1/seller_preferences?select=workspace_id,onboarding_completed,experience_level,goal,monthly_budget_ron&limit=2000`,h,fetchImpl),
        jsonFetch(`${supabaseUrl}/rest/v1/subscriptions?select=workspace_id,plan,status,current_period_end&limit=2000`,h,fetchImpl).catch(()=>[])
      ]);
      return Response.json({ok:true,...aggregate({events,workspaces,preferences,subscriptions},days)},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export {aggregate};
export default createBetaAnalyticsHandler();
export const config={path:'/api/internal/beta-analytics',method:'GET'};
