import {SAAS_CONFIG} from '../../saas-config.js';

export function createBillingStatusHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const auth=request.headers.get('authorization')||'';
      if(!/^Bearer\s+\S+/i.test(auth))return Response.json({ok:false,error:'Authentication required'},{status:401});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const headers={apikey:anon,authorization:auth,accept:'application/json'};
      const user=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
      if(!user.ok)return Response.json({ok:false,error:'Invalid or expired session'},{status:401});
      const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,name,plan&limit=1`,{headers});
      if(!workspaceResponse.ok)return Response.json({ok:false,error:'Workspace lookup failed'},{status:502});
      const workspace=(await workspaceResponse.json())?.[0];
      if(!workspace)return Response.json({ok:false,error:'Workspace required'},{status:409});
      const subResponse=await fetchImpl(`${supabaseUrl}/rest/v1/subscriptions?select=plan,status,current_period_end,cancel_at_period_end,provider_subscription_id&workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`,{headers});
      const subscription=subResponse.ok?(await subResponse.json())?.[0]||null:null;
      return Response.json({ok:true,workspace:{id:workspace.id,name:workspace.name,plan:String(workspace.plan||'FREE').toUpperCase()},subscription:subscription?{plan:String(subscription.plan||'FREE').toUpperCase(),status:String(subscription.status||'FOUNDATION'),currentPeriodEnd:subscription.current_period_end||null,cancelAtPeriodEnd:Boolean(subscription.cancel_at_period_end),managedByStripe:Boolean(subscription.provider_subscription_id)}:null},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}
  };
}

export default createBillingStatusHandler();
export const config={path:'/api/billing/status',method:'GET'};
