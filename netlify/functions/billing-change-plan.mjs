import {resolveBillingWorkspaceAccess} from './_billing-workspace-access.mjs';
import {billingMutationIdempotencyKey} from './_billing-mutation-idempotency.mjs';

const PRICE_ENV={DISCOVER:'STRIPE_PRICE_DISCOVER',RADAR:'STRIPE_PRICE_RADAR',LAUNCH:'STRIPE_PRICE_LAUNCH'};

export function createBillingChangePlanHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!env.STRIPE_SECRET_KEY)return Response.json({ok:false,error:'Stripe billing is not configured'},{status:503});
      const state=await resolveBillingWorkspaceAccess(request,{fetchImpl,env,mode:'OWNER'});
      if(state.error)return Response.json({ok:false,error:state.error,code:state.code},{status:state.status});
      const body=await request.json().catch(()=>({}));
      const plan=String(body.plan||'').toUpperCase();
      if(!PRICE_ENV[plan])return Response.json({ok:false,error:'Unsupported billing plan'},{status:400});
      const sub=state.subscription;
      if(!sub?.provider_subscription_id||!['active','trialing'].includes(String(sub.status||'').toLowerCase()))return Response.json({ok:false,code:'NO_ACTIVE_SUBSCRIPTION',error:'Nu există un abonament Stripe activ care să poată fi modificat.'},{status:409});
      if(String(sub.plan||state.workspace.plan||'').toUpperCase()===plan)return Response.json({ok:true,unchanged:true,plan,workspaceId:state.workspace.id});
      const priceId=env[PRICE_ENV[plan]];
      if(!priceId)return Response.json({ok:false,error:`Missing Stripe price for ${plan}`},{status:503});
      const mutationKey=billingMutationIdempotencyKey({workspaceId:state.workspace.id,subscriptionId:sub.provider_subscription_id,lastStripeEventId:sub.last_stripe_event_id,operation:'plan-change',target:plan});
      if(!mutationKey)return Response.json({ok:false,error:'Billing mutation identity unavailable'},{status:503});
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
      const update=await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`,{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded','idempotency-key':mutationKey},body:params});
      const updated=await update.json();
      if(!update.ok)return Response.json({ok:false,error:'Stripe plan change failed'},{status:502});
      return Response.json({ok:true,workspaceId:state.workspace.id,plan,status:updated.status||sub.status,mode:'PLAN_CHANGE'},{headers:{'Cache-Control':'private, no-store'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}
  };
}

export default createBillingChangePlanHandler();
export const config={path:'/api/billing/change-plan',method:'POST'};
