import {SAAS_CONFIG} from '../../saas-config.js';

const PRICE_ENV={DISCOVER:'STRIPE_PRICE_DISCOVER',RADAR:'STRIPE_PRICE_RADAR',LAUNCH:'STRIPE_PRICE_LAUNCH'};

async function resolveBillingState(request,{fetchImpl,env}){
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth))return {error:'Authentication required',status:401};
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
  const headers={apikey:anon,authorization:auth,accept:'application/json'};
  const userResponse=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
  if(!userResponse.ok)return {error:'Invalid or expired session',status:401};
  const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,plan&limit=1`,{headers});
  if(!workspaceResponse.ok)return {error:'Workspace lookup failed',status:502};
  const workspace=(await workspaceResponse.json())?.[0];
  if(!workspace)return {error:'Workspace required',status:409};
  const subResponse=await fetchImpl(`${supabaseUrl}/rest/v1/subscriptions?select=workspace_id,plan,status,provider_subscription_id&workspace_id=eq.${encodeURIComponent(workspace.id)}&limit=1`,{headers});
  if(!subResponse.ok)return {error:'Subscription lookup failed',status:502};
  const subscription=(await subResponse.json())?.[0];
  return {workspace,subscription};
}

export function createBillingChangePlanHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!env.STRIPE_SECRET_KEY)return Response.json({ok:false,error:'Stripe billing is not configured'},{status:503});
      const state=await resolveBillingState(request,{fetchImpl,env});
      if(state.error)return Response.json({ok:false,error:state.error},{status:state.status});
      const body=await request.json().catch(()=>({}));
      const plan=String(body.plan||'').toUpperCase();
      if(!PRICE_ENV[plan])return Response.json({ok:false,error:'Unsupported billing plan'},{status:400});
      const sub=state.subscription;
      if(!sub?.provider_subscription_id||!['active','trialing'].includes(String(sub.status||'').toLowerCase()))return Response.json({ok:false,code:'NO_ACTIVE_SUBSCRIPTION',error:'Nu există un abonament Stripe activ care să poată fi modificat.'},{status:409});
      if(String(sub.plan||state.workspace.plan||'').toUpperCase()===plan)return Response.json({ok:true,unchanged:true,plan});
      const priceId=env[PRICE_ENV[plan]];
      if(!priceId)return Response.json({ok:false,error:`Missing Stripe price for ${plan}`},{status:503});
      const getSub=await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
      const stripeSub=await getSub.json();
      const itemId=stripeSub?.items?.data?.[0]?.id;
      if(!getSub.ok||!itemId)return Response.json({ok:false,error:'Stripe subscription item unavailable'},{status:502});
      const params=new URLSearchParams();
      params.set('items[0][id]',itemId);
      params.set('items[0][price]',priceId);
      params.set('proration_behavior','create_prorations');
      params.set('metadata[workspace_id]',state.workspace.id);
      params.set('metadata[plan]',plan);
      const update=await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`,{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded'},body:params});
      const updated=await update.json();
      if(!update.ok)return Response.json({ok:false,error:'Stripe plan change failed'},{status:502});
      return Response.json({ok:true,plan,status:updated.status||sub.status,mode:'PLAN_CHANGE'},{headers:{'Cache-Control':'private, no-store'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}
  };
}

export default createBillingChangePlanHandler();
export const config={path:'/api/billing/change-plan',method:'POST'};
