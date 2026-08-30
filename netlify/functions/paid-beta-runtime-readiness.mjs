import {SAAS_CONFIG} from '../../saas-config.js';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization'};

async function jsonFetch(url,options,fetchImpl){
  const response=await fetchImpl(url,options);
  let body={};
  try{body=await response.json();}catch{}
  return {ok:response.ok,status:response.status,body};
}

function normalizeRuntime(body){
  const row=Array.isArray(body)?body[0]||{}:body||{};
  return {
    ready:Boolean(row.ready),
    checks:{
      subscriptionsTable:Boolean(row.subscriptions_table),
      webhookEventsTable:Boolean(row.webhook_events_table),
      orderingCreatedColumn:Boolean(row.ordering_created_column),
      orderingEventIdColumn:Boolean(row.ordering_event_id_column),
      webhookStatusColumn:Boolean(row.webhook_status_column),
      webhookErrorColumn:Boolean(row.webhook_error_column),
      atomicApplyRpc:Boolean(row.atomic_apply_rpc)
    }
  };
}

export function createPaidBetaRuntimeReadinessHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const auth=request.headers.get('authorization')||'';
      if(!/^Bearer\s+\S+/i.test(auth))return Response.json({ok:false,error:'Authentication required'},{status:401,headers:RESPONSE_HEADERS});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      if(!supabaseUrl||!anon)return Response.json({ok:false,error:'Supabase access is not configured'},{status:503,headers:RESPONSE_HEADERS});
      const userCheck=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anon,authorization:auth}},fetchImpl);
      if(!userCheck.ok)return Response.json({ok:false,error:'Invalid or expired session'},{status:401,headers:RESPONSE_HEADERS});
      const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if(!allowed.length)return Response.json({ok:false,error:'Admin allowlist is not configured'},{status:503,headers:RESPONSE_HEADERS});
      if(!allowed.includes(String(userCheck.body?.email||'').toLowerCase()))return Response.json({ok:false,error:'Admin access required'},{status:403,headers:RESPONSE_HEADERS});
      const serviceRole=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!serviceRole)return Response.json({ok:true,ready:false,checks:{serviceRolePresent:false},reason:'SERVICE_ROLE_MISSING'},{headers:RESPONSE_HEADERS});
      const runtime=await jsonFetch(`${supabaseUrl}/rest/v1/rpc/mpr_billing_runtime_readiness`,{method:'POST',headers:{apikey:serviceRole,authorization:`Bearer ${serviceRole}`,'content-type':'application/json',accept:'application/json'},body:'{}'},fetchImpl);
      if(!runtime.ok)return Response.json({ok:true,ready:false,checks:{serviceRolePresent:true,runtimeProbeAvailable:false},reason:'BILLING_RUNTIME_PROBE_UNAVAILABLE'},{headers:RESPONSE_HEADERS});
      const state=normalizeRuntime(runtime.body);
      return Response.json({ok:true,...state,checks:{serviceRolePresent:true,runtimeProbeAvailable:true,...state.checks},reason:state.ready?'READY':'DATABASE_RUNTIME_INCOMPLETE'},{headers:RESPONSE_HEADERS});
    }catch(error){return Response.json({ok:false,ready:false,error:String(error?.message||error)},{status:500,headers:RESPONSE_HEADERS});}
  };
}

export {normalizeRuntime};
export default createPaidBetaRuntimeReadinessHandler();
export const config={path:'/api/internal/paid-beta-runtime-readiness',method:'GET'};
