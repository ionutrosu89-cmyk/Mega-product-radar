import {SAAS_CONFIG} from '../../saas-config.js';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';
import {stripeMode} from './billing-readiness.mjs';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization, X-MPR-Workspace-Id'};
const ACTIVE_STATUSES=new Set(['active','trialing']);
const text=value=>String(value??'').trim();
const upper=value=>text(value).toUpperCase();
const lower=value=>text(value).toLowerCase();

async function jsonFetch(url,options,fetchImpl){
  const response=await fetchImpl(url,options);
  let body={};
  try{body=await response.json();}catch{}
  return {ok:response.ok,status:response.status,body};
}

export function buildBillingJourneySnapshot({workspaceId,workspace,subscription,stripeSubscriptions=[],observedAt=new Date().toISOString()}={}){
  const providerSubscriptionId=text(subscription?.provider_subscription_id);
  const activeSubscriptionCount=Array.isArray(stripeSubscriptions)
    ? stripeSubscriptions.filter(item=>ACTIVE_STATUSES.has(lower(item?.status))).length
    : 0;
  return {
    schema:'MPR_STRIPE_SANDBOX_JOURNEY_CHECKPOINT_V1',
    environment:'SANDBOX',
    workspaceId:text(workspaceId),
    workspacePlan:upper(workspace?.plan)||'FREE',
    subscriptionStatus:subscription?lower(subscription.status)||'unknown':'none',
    providerSubscriptionId,
    activeSubscriptionCount,
    cancelAtPeriodEnd:Boolean(subscription?.cancel_at_period_end),
    lastStripeEventId:text(subscription?.last_stripe_event_id),
    observedAt:text(observedAt),
    source:{workspace:'SUPABASE',subscription:'SUPABASE',activeSubscriptionCount:'STRIPE'}
  };
}

export function createBillingJourneySnapshotHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date()}={}){
  return async request=>{
    try{
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const authorization=await authorizeReadinessRequest({request,env,fetchImpl,supabaseUrl,anonKey:anon});
      if(!authorization.ok)return authorization.response;

      const workspaceId=text(request.headers.get('x-mpr-workspace-id'));
      if(!workspaceId)return Response.json({ok:false,code:'WORKSPACE_CONTEXT_REQUIRED',error:'Explicit workspace context required'},{status:400,headers:RESPONSE_HEADERS});
      if(stripeMode(env.STRIPE_SECRET_KEY)!=='SANDBOX')return Response.json({ok:false,code:'SANDBOX_ONLY',error:'Billing journey evidence snapshots require Stripe Test Mode'},{status:409,headers:RESPONSE_HEADERS});
      if(!supabaseUrl||!env.SUPABASE_SERVICE_ROLE_KEY)return Response.json({ok:false,code:'SNAPSHOT_NOT_CONFIGURED',error:'Billing journey snapshot is not configured'},{status:503,headers:RESPONSE_HEADERS});

      const service=env.SUPABASE_SERVICE_ROLE_KEY;
      const dbHeaders={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
      const workspaceResult=await jsonFetch(`${supabaseUrl}/rest/v1/workspaces?select=id,plan&id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers:dbHeaders},fetchImpl);
      if(!workspaceResult.ok)return Response.json({ok:false,code:'WORKSPACE_LOOKUP_FAILED',error:'Workspace lookup failed'},{status:502,headers:RESPONSE_HEADERS});
      const workspace=Array.isArray(workspaceResult.body)?workspaceResult.body[0]||null:null;
      if(!workspace)return Response.json({ok:false,code:'WORKSPACE_NOT_FOUND',error:'Workspace not found'},{status:404,headers:RESPONSE_HEADERS});

      const subscriptionResult=await jsonFetch(`${supabaseUrl}/rest/v1/subscriptions?select=plan,status,provider_customer_id,provider_subscription_id,cancel_at_period_end,last_stripe_event_id&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers:dbHeaders},fetchImpl);
      if(!subscriptionResult.ok)return Response.json({ok:false,code:'SUBSCRIPTION_LOOKUP_FAILED',error:'Subscription lookup failed'},{status:502,headers:RESPONSE_HEADERS});
      const subscription=Array.isArray(subscriptionResult.body)?subscriptionResult.body[0]||null:null;

      let stripeSubscriptions=[];
      const customerId=text(subscription?.provider_customer_id);
      if(customerId){
        const params=new URLSearchParams({customer:customerId,status:'all',limit:'100'});
        const stripeResult=await jsonFetch(`https://api.stripe.com/v1/subscriptions?${params}`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}},fetchImpl);
        if(!stripeResult.ok)return Response.json({ok:false,code:'STRIPE_SUBSCRIPTION_LOOKUP_FAILED',error:'Stripe subscription lookup failed'},{status:502,headers:RESPONSE_HEADERS});
        stripeSubscriptions=Array.isArray(stripeResult.body?.data)?stripeResult.body.data:[];
      }else if(subscription?.provider_subscription_id){
        return Response.json({ok:false,code:'STRIPE_CUSTOMER_ID_MISSING',error:'Cannot prove active subscription count without Stripe customer identity'},{status:409,headers:RESPONSE_HEADERS});
      }

      const checkpoint=buildBillingJourneySnapshot({workspaceId,workspace,subscription,stripeSubscriptions,observedAt:now().toISOString()});
      return Response.json({ok:true,checkpoint},{headers:RESPONSE_HEADERS});
    }catch(error){
      return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:RESPONSE_HEADERS});
    }
  };
}

export default createBillingJourneySnapshotHandler();
export const config={path:'/api/internal/billing-journey-snapshot',method:'GET'};
