import {SAAS_CONFIG} from '../../saas-config.js';
import {assessSandboxWorkspacePreflight} from '../../scripts/verify-paid-beta-deployment.mjs';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';
import {buildBillingJourneySnapshot} from './billing-journey-snapshot.mjs';
import {stripeMode} from './billing-readiness.mjs';

const HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization'};
const text=value=>String(value??'').trim();
async function jsonFetch(url,options,fetchImpl){const response=await fetchImpl(url,options);let body={};try{body=await response.json();}catch{}return {ok:response.ok,status:response.status,body};}

export function createSandboxPreflightReadinessHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date()}={}){
  return async request=>{try{
    const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
    const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
    const authorization=await authorizeReadinessRequest({request,env,fetchImpl,supabaseUrl,anonKey:anon});
    if(!authorization.ok)return authorization.response;
    const workspaceId=text(env.MPR_SANDBOX_WORKSPACE_ID);
    if(!workspaceId)return Response.json({ok:true,ready:false,configured:false,checks:{workspaceConfigured:false,workspaceFree:false,zeroActiveSubscriptions:false,noScheduledCancellation:false,inactiveLocalSubscription:false},reason:'SANDBOX_WORKSPACE_NOT_CONFIGURED'},{headers:HEADERS});
    if(stripeMode(env.STRIPE_SECRET_KEY)!=='SANDBOX')return Response.json({ok:true,ready:false,configured:true,checks:{workspaceConfigured:true,workspaceFree:false,zeroActiveSubscriptions:false,noScheduledCancellation:false,inactiveLocalSubscription:false},reason:'STRIPE_NOT_SANDBOX'},{headers:HEADERS});
    const service=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!supabaseUrl||!service)return Response.json({ok:false,error:'Sandbox preflight is not configured'},{status:503,headers:HEADERS});
    const dbHeaders={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
    const workspaceResult=await jsonFetch(`${supabaseUrl}/rest/v1/workspaces?select=id,plan&id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers:dbHeaders},fetchImpl);
    if(!workspaceResult.ok)return Response.json({ok:false,error:'Workspace lookup failed'},{status:502,headers:HEADERS});
    const workspace=Array.isArray(workspaceResult.body)?workspaceResult.body[0]||null:null;
    if(!workspace)return Response.json({ok:true,ready:false,configured:true,checks:{workspaceConfigured:true,workspaceExists:false,workspaceFree:false,zeroActiveSubscriptions:false,noScheduledCancellation:false,inactiveLocalSubscription:false},reason:'SANDBOX_WORKSPACE_NOT_FOUND'},{headers:HEADERS});
    const subscriptionResult=await jsonFetch(`${supabaseUrl}/rest/v1/subscriptions?select=plan,status,provider_customer_id,provider_subscription_id,cancel_at_period_end,last_stripe_event_id&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers:dbHeaders},fetchImpl);
    if(!subscriptionResult.ok)return Response.json({ok:false,error:'Subscription lookup failed'},{status:502,headers:HEADERS});
    const subscription=Array.isArray(subscriptionResult.body)?subscriptionResult.body[0]||null:null;
    let stripeSubscriptions=[];
    const customerId=text(subscription?.provider_customer_id);
    if(customerId){const params=new URLSearchParams({customer:customerId,status:'all',limit:'100'});const stripeResult=await jsonFetch(`https://api.stripe.com/v1/subscriptions?${params}`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}},fetchImpl);if(!stripeResult.ok)return Response.json({ok:false,error:'Stripe subscription lookup failed'},{status:502,headers:HEADERS});stripeSubscriptions=Array.isArray(stripeResult.body?.data)?stripeResult.body.data:[];}
    else if(subscription?.provider_subscription_id)return Response.json({ok:true,ready:false,configured:true,checks:{workspaceConfigured:true,workspaceExists:true,workspaceFree:String(workspace.plan||'').toUpperCase()==='FREE',zeroActiveSubscriptions:false,noScheduledCancellation:!subscription.cancel_at_period_end,inactiveLocalSubscription:false},reason:'STRIPE_CUSTOMER_ID_MISSING'},{headers:HEADERS});
    const checkpoint=buildBillingJourneySnapshot({workspaceId,workspace,subscription,stripeSubscriptions,observedAt:now().toISOString()});
    const state=assessSandboxWorkspacePreflight(checkpoint);
    const inactive=['','none','canceled','cancelled','incomplete_expired','unpaid'].includes(state.subscriptionStatus);
    return Response.json({ok:true,ready:state.clean,configured:true,checks:{workspaceConfigured:true,workspaceExists:true,workspaceFree:state.workspacePlan==='FREE',zeroActiveSubscriptions:state.activeSubscriptionCount===0,noScheduledCancellation:state.cancelAtPeriodEnd===false,inactiveLocalSubscription:inactive},reason:state.clean?null:'SANDBOX_WORKSPACE_NOT_CLEAN'},{headers:HEADERS});
  }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:HEADERS});}};
}

export default createSandboxPreflightReadinessHandler();
export const config={path:'/api/internal/sandbox-preflight-readiness',method:'GET'};
