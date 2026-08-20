import {SAAS_CONFIG} from '../../saas-config.js';

const PRICE_ENV={DISCOVER:'STRIPE_PRICE_DISCOVER',RADAR:'STRIPE_PRICE_RADAR',LAUNCH:'STRIPE_PRICE_LAUNCH'};

async function resolveUserWorkspace(request,{fetchImpl,env}){
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth)) return {error:'Authentication required',status:401};
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const apiKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
  const headers={apikey:apiKey,authorization:auth};
  const userResponse=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
  if(!userResponse.ok)return {error:'Invalid or expired session',status:401};
  const user=await userResponse.json();
  const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,name,plan&limit=1`,{headers:{...headers,accept:'application/json'}});
  if(!workspaceResponse.ok)return {error:'Workspace lookup failed',status:502};
  const workspaces=await workspaceResponse.json();
  const workspace=Array.isArray(workspaces)?workspaces[0]:null;
  if(!workspace)return {error:'Workspace required',status:409};
  return {user,workspace};
}

export function createBillingCheckoutHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!env.STRIPE_SECRET_KEY)return Response.json({ok:false,error:'Stripe billing is not configured'},{status:503,headers:{'Cache-Control':'no-store'}});
      const access=await resolveUserWorkspace(request,{fetchImpl,env});
      if(access.error)return Response.json({ok:false,error:access.error},{status:access.status,headers:{'Cache-Control':'no-store'}});
      const body=await request.json().catch(()=>({}));
      const plan=String(body.plan||'').toUpperCase();
      if(!PRICE_ENV[plan])return Response.json({ok:false,error:'Unsupported billing plan'},{status:400,headers:{'Cache-Control':'no-store'}});
      const priceId=env[PRICE_ENV[plan]];
      if(!priceId)return Response.json({ok:false,error:`Missing Stripe price for ${plan}`},{status:503,headers:{'Cache-Control':'no-store'}});
      const origin=new URL(request.url).origin;
      const params=new URLSearchParams();
      params.set('mode','subscription');
      params.set('line_items[0][price]',priceId);
      params.set('line_items[0][quantity]','1');
      params.set('success_url',`${origin}/account.html?billing=success`);
      params.set('cancel_url',`${origin}/pricing.html?billing=cancel`);
      params.set('client_reference_id',access.workspace.id);
      params.set('metadata[workspace_id]',access.workspace.id);
      params.set('metadata[plan]',plan);
      params.set('subscription_data[metadata][workspace_id]',access.workspace.id);
      params.set('subscription_data[metadata][plan]',plan);
      params.set('allow_promotion_codes','true');
      if(access.user?.email)params.set('customer_email',access.user.email);
      const stripeResponse=await fetchImpl('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded'},body:params});
      const stripe=await stripeResponse.json();
      if(!stripeResponse.ok||!stripe?.url)return Response.json({ok:false,error:'Stripe checkout creation failed'},{status:502,headers:{'Cache-Control':'no-store'}});
      return Response.json({ok:true,url:stripe.url,plan},{headers:{'Cache-Control':'private, no-store'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export default createBillingCheckoutHandler();
export const config={path:'/api/billing/checkout',method:'POST'};
