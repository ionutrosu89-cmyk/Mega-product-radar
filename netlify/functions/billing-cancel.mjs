import {resolveBillingWorkspaceAccess} from './_billing-workspace-access.mjs';

export function createBillingCancelHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!env.STRIPE_SECRET_KEY)return Response.json({ok:false,error:'Stripe billing is not configured'},{status:503});
      const state=await resolveBillingWorkspaceAccess(request,{fetchImpl,env,mode:'OWNER'});
      if(state.error)return Response.json({ok:false,error:state.error,code:state.code},{status:state.status});
      const sub=state.subscription;
      if(!sub?.provider_subscription_id||!['active','trialing','past_due'].includes(String(sub.status||'').toLowerCase()))return Response.json({ok:false,error:'No active Stripe subscription to cancel'},{status:409});
      const params=new URLSearchParams({cancel_at_period_end:'true'});
      const stripeResponse=await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`,{method:'POST',headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded'},body:params});
      const stripe=await stripeResponse.json();
      if(!stripeResponse.ok)return Response.json({ok:false,error:'Stripe cancellation request failed'},{status:502});
      return Response.json({ok:true,workspaceId:state.workspace.id,status:stripe.status||sub.status,cancelAtPeriodEnd:Boolean(stripe.cancel_at_period_end),currentPeriodEnd:stripe.current_period_end?new Date(stripe.current_period_end*1000).toISOString():null},{headers:{'Cache-Control':'private, no-store'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}
  };
}

export default createBillingCancelHandler();
export const config={path:'/api/billing/cancel',method:'POST'};
