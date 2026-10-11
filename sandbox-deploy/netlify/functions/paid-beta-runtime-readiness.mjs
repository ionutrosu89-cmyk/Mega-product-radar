import {SAAS_CONFIG} from '../../saas-config.js';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';

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
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const authorization=await authorizeReadinessRequest({request,env,fetchImpl,supabaseUrl,anonKey:anon});
      if(!authorization.ok)return authorization.response;
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
