import {resolveBillingWorkspaceAccess} from './_billing-workspace-access.mjs';
import {freeBetaBillingResponse,paidBillingEnabled} from './_commercial-launch-mode.mjs';

const PRICE_ENV={DISCOVER:'STRIPE_PRICE_DISCOVER',RADAR:'STRIPE_PRICE_RADAR',LAUNCH:'STRIPE_PRICE_LAUNCH'};
const CHECKOUT_ATTEMPT_RE=/^[A-Za-z0-9_-]{16,100}$/;

function validCheckoutAttemptId(value=''){return CHECKOUT_ATTEMPT_RE.test(String(value||''));}
function checkoutIdempotencyKey(workspaceId,plan,attemptId){
  if(!workspaceId||!PRICE_ENV[String(plan||'').toUpperCase()]||!validCheckoutAttemptId(attemptId))return null;
  return `mpr-checkout:${workspaceId}:${String(plan).toUpperCase()}:${attemptId}`;
}

async function recordJourneyEvent({workspaceId,userId,plan,eventName,metadata},{fetchImpl,env}){
  const service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!service||!workspaceId||!userId)return false;
  try{
    const supabaseUrl=env.SUPABASE_URL;
    if(!supabaseUrl)return false;
    const response=await fetchImpl(`${supabaseUrl}/rest/v1/journey_events`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'return=minimal'},body:JSON.stringify({workspace_id:workspaceId,user_id:userId,event_name:eventName,plan:String(plan||'FREE').toUpperCase(),page:'/api/billing/checkout',metadata:metadata||{}})});
    return response.ok;
  }catch{return false;}
}

export function createBillingCheckoutHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!paidBillingEnabled(env))return freeBetaBillingResponse();
      if(!env.STRIPE_SECRET_KEY)return Response.json({ok:false,error:'Stripe billing is not configured'},{status:503,headers:{'Cache-Control':'no-store'}});
      const access=await resolveBillingWorkspaceAccess(request,{fetchImpl,env,mode:'OWNER'});
      if(access.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status,headers:{'Cache-Control':'no-store'}});
      const body=await request.json().catch(()=>({}));
      const plan=String(body.plan||'').toUpperCase();
      if(!PRICE_ENV[plan])return Response.json({ok:false,error:'Unsupported billing plan'},{status:400,headers:{'Cache-Control':'no-store'}});
      const checkoutAttemptId=String(body.checkoutAttemptId||'');
      const idempotencyKey=checkoutIdempotencyKey(access.workspace.id,plan,checkoutAttemptId);
      if(!idempotencyKey)return Response.json({ok:false,code:'CHECKOUT_ATTEMPT_REQUIRED',error:'Checkout attempt identity is missing or invalid.'},{status:400,headers:{'Cache-Control':'no-store'}});
      const current=access.subscription;
      const currentStatus=String(current?.status||'').toLowerCase();
      if(['active','trialing'].includes(currentStatus)&&current?.provider_subscription_id){
        const samePlan=String(current.plan||access.workspace.plan||'').toUpperCase()===plan;
        return Response.json({ok:false,code:samePlan?'ALREADY_ON_PLAN':'ACTIVE_SUBSCRIPTION_EXISTS',error:samePlan?'Acest plan este deja activ.':'Planul se schimbă pe abonamentul Stripe existent; nu se creează un al doilea abonament.',currentPlan:String(current.plan||access.workspace.plan||'FREE').toUpperCase(),requestedPlan:plan},{status:409,headers:{'Cache-Control':'private, no-store'}});
      }
      const priceId=env[PRICE_ENV[plan]];
      if(!priceId)return Response.json({ok:false,error:`Missing Stripe price for ${plan}`},{status:503,headers:{'Cache-Control':'no-store'}});
      const origin=new URL(request.url).origin;
      const params=new URLSearchParams();
      params.set('mode','subscription');
      params.set('line_items[0][price]',priceId);
      params.set('line_items[0][quantity]','1');
      params.set('success_url',`${origin}/account.html?billing=success&plan=${encodeURIComponent(plan)}`);
      params.set('cancel_url',`${origin}/pricing.html?billing=cancel`);
      params.set('client_reference_id',access.workspace.id);
      params.set('metadata[workspace_id]',access.workspace.id);
      params.set('metadata[plan]',plan);
      params.set('metadata[checkout_attempt_id]',checkoutAttemptId);
      params.set('subscription_data[metadata][workspace_id]',access.workspace.id);
      params.set('subscription_data[metadata][plan]',plan);
      params.set('subscription_data[metadata][checkout_attempt_id]',checkoutAttemptId);
      params.set('allow_promotion_codes','true');
      if(access.user?.email)params.set('customer_email',access.user.email);
      const stripeResponse=await fetchImpl('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':idempotencyKey},body:params});
      const stripe=await stripeResponse.json();
      if(!stripeResponse.ok||!stripe?.url)return Response.json({ok:false,error:'Stripe checkout creation failed'},{status:502,headers:{'Cache-Control':'no-store'}});
      await recordJourneyEvent({workspaceId:access.workspace.id,userId:access.user?.id,plan:access.workspace.plan,eventName:'CHECKOUT_STARTED',metadata:{requestedPlan:plan,stripeSessionId:String(stripe.id||''),checkoutAttemptId}},{fetchImpl,env});
      return Response.json({ok:true,url:stripe.url,plan,mode:'NEW_SUBSCRIPTION',workspaceId:access.workspace.id},{headers:{'Cache-Control':'private, no-store'}});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {recordJourneyEvent,validCheckoutAttemptId,checkoutIdempotencyKey};
export default createBillingCheckoutHandler();
export const config={path:'/api/billing/checkout',method:'POST'};
