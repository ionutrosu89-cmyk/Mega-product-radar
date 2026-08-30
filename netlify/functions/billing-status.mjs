import {SAAS_CONFIG} from '../../saas-config.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization, X-MPR-Workspace-Id'};

export function createBillingStatusHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const access=await resolveWorkspaceAccess(request,{fetchImpl,env});
      if(access.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status,headers:RESPONSE_HEADERS});
      const auth=request.headers.get('authorization')||'';
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      if(!supabaseUrl||!anon)return Response.json({ok:false,error:'Supabase billing status is not configured',code:'BILLING_STATUS_NOT_CONFIGURED'},{status:503,headers:RESPONSE_HEADERS});
      const headers={apikey:anon,authorization:auth,accept:'application/json'};
      const subResponse=await fetchImpl(`${supabaseUrl}/rest/v1/subscriptions?select=plan,status,current_period_end,cancel_at_period_end,provider_subscription_id&workspace_id=eq.${encodeURIComponent(access.workspaceId)}&limit=1`,{headers});
      if(!subResponse.ok)return Response.json({ok:false,error:'Subscription status lookup failed',code:'SUBSCRIPTION_STATUS_LOOKUP_FAILED'},{status:502,headers:RESPONSE_HEADERS});
      const subscription=(await subResponse.json())?.[0]||null;
      return Response.json({ok:true,workspace:{id:access.workspace.id,name:access.workspace.name,plan:String(access.workspace.plan||'FREE').toUpperCase(),role:access.membership.role},subscription:subscription?{plan:String(subscription.plan||'FREE').toUpperCase(),status:String(subscription.status||'FOUNDATION'),currentPeriodEnd:subscription.current_period_end||null,cancelAtPeriodEnd:Boolean(subscription.cancel_at_period_end),managedByStripe:Boolean(subscription.provider_subscription_id)}:null},{headers:RESPONSE_HEADERS});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:RESPONSE_HEADERS});}
  };
}
export default createBillingStatusHandler();
export const config={path:'/api/billing/status',method:'GET'};
