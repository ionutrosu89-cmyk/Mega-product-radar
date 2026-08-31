import {SAAS_CONFIG} from '../../saas-config.js';
import {REQUIRED_STAGES} from '../../scripts/verify-billing-journey-evidence.mjs';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization'};
const GITHUB_SHA_RE=/^[0-9a-f]{40}$/i;
const PRICE_ENV={DISCOVER_ACTIVE:'STRIPE_PRICE_DISCOVER',RADAR_ACTIVE:'STRIPE_PRICE_RADAR',LAUNCH_ACTIVE:'STRIPE_PRICE_LAUNCH'};
const text=value=>String(value??'').trim();
const active=status=>['active','trialing'].includes(text(status).toLowerCase());

async function jsonFetch(url,options,fetchImpl){
  const response=await fetchImpl(url,options);
  let body={};
  try{body=await response.json();}catch{}
  return {ok:response.ok,status:response.status,body};
}
async function stripeForm(path,params,{env,fetchImpl,idempotencyKey,method='POST'}){
  const headers={authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded'};
  if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
  return jsonFetch(`https://api.stripe.com/v1/${path}`,{method,headers,body:params?new URLSearchParams(params):undefined},fetchImpl);
}
async function resolveWorkspace({supabaseUrl,service,env,fetchImpl}){
  const headers={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
  const configured=text(env.MPR_SANDBOX_WORKSPACE_ID);
  const filter=configured?`id=eq.${encodeURIComponent(configured)}`:`slug=eq.${encodeURIComponent(text(env.MPR_SANDBOX_WORKSPACE_SLUG)||'mpr-billing-sandbox')}`;
  const result=await jsonFetch(`${supabaseUrl}/rest/v1/workspaces?select=id,plan&${filter}&limit=1`,{headers},fetchImpl);
  const row=Array.isArray(result.body)?result.body[0]||null:null;
  return result.ok&&row?row:null;
}
async function loadSubscription({supabaseUrl,service,workspaceId,fetchImpl}){
  const headers={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
  const result=await jsonFetch(`${supabaseUrl}/rest/v1/subscriptions?select=plan,status,provider_customer_id,provider_subscription_id,cancel_at_period_end,last_stripe_event_id&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers},fetchImpl);
  if(!result.ok||!Array.isArray(result.body))return {ok:false,row:null};
  return {ok:true,row:result.body[0]||null};
}
async function loadAcceptance({supabaseUrl,service,workspaceId,deploymentRef,fetchImpl}){
  const headers={apikey:service,authorization:`Bearer ${service}`,accept:'application/json'};
  const result=await jsonFetch(`${supabaseUrl}/rest/v1/billing_e2e_acceptance_runs?select=status,checkpoint_count&environment=eq.SANDBOX&workspace_id=eq.${encodeURIComponent(workspaceId)}&deployment_ref=eq.${encodeURIComponent(deploymentRef)}&limit=1`,{headers},fetchImpl);
  return result.ok&&Array.isArray(result.body)?result.body[0]||null:null;
}
function expectedStage(row){const count=Number(row?.checkpoint_count)||0;return REQUIRED_STAGES[count]||null;}
function safeError(code,error,status=409){return Response.json({ok:false,code,error},{status,headers:RESPONSE_HEADERS});}

async function assertNoRemoteActiveSubscriptions({customerId,env,fetchImpl}){
  if(!customerId)return;
  const remote=await jsonFetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}},fetchImpl);
  if(!remote.ok||!Array.isArray(remote.body?.data))throw new Error('REMOTE_SUBSCRIPTION_STATE_UNAVAILABLE');
  if(remote.body.data.some(item=>active(item?.status)))throw new Error('REMOTE_ACTIVE_SUBSCRIPTION_EXISTS');
}
async function ensureTestCustomer({workspaceId,deploymentRef,subscription,env,fetchImpl}){
  let customerId=text(subscription?.provider_customer_id);
  if(!customerId){
    const created=await stripeForm('customers',{'metadata[workspace_id]':workspaceId,description:'MPR automated sandbox billing acceptance',source:'tok_visa'},{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:customer`});
    if(!created.ok||!created.body?.id)throw new Error('TEST_CUSTOMER_CREATE_FAILED');
    customerId=String(created.body.id);
  }else{
    await assertNoRemoteActiveSubscriptions({customerId,env,fetchImpl});
    const updated=await stripeForm(`customers/${encodeURIComponent(customerId)}`,{source:'tok_visa','metadata[workspace_id]':workspaceId},{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:customer-source`});
    if(!updated.ok)throw new Error('TEST_CUSTOMER_UPDATE_FAILED');
  }
  return customerId;
}
async function createDiscover({workspace,subscription,deploymentRef,env,fetchImpl}){
  if(String(workspace.plan||'FREE').toUpperCase()!=='FREE'||active(subscription?.status))throw new Error('SANDBOX_NOT_FREE');
  const price=text(env.STRIPE_PRICE_DISCOVER);if(!price)throw new Error('DISCOVER_PRICE_MISSING');
  const customerId=await ensureTestCustomer({workspaceId:workspace.id,deploymentRef,subscription,env,fetchImpl});
  const created=await stripeForm('subscriptions',{customer:customerId,'items[0][price]':price,'metadata[workspace_id]':workspace.id,'metadata[plan]':'DISCOVER',payment_behavior:'error_if_incomplete'},{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:discover-subscription`});
  if(!created.ok||!created.body?.id||!active(created.body.status))throw new Error('DISCOVER_SUBSCRIPTION_CREATE_FAILED');
  return {action:'CREATED_TEST_SUBSCRIPTION'};
}
async function changePlan({stage,workspace,subscription,deploymentRef,env,fetchImpl}){
  const target=stage==='RADAR_ACTIVE'?'RADAR':'LAUNCH';
  const previous=target==='RADAR'?'DISCOVER':'RADAR';
  if(!active(subscription?.status)||String(subscription?.plan||'').toUpperCase()!==previous||!subscription?.provider_subscription_id)throw new Error(`EXPECTED_${previous}_ACTIVE`);
  const price=text(env[PRICE_ENV[stage]]);if(!price)throw new Error(`${target}_PRICE_MISSING`);
  const fetched=await jsonFetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}},fetchImpl);
  const itemId=fetched.body?.items?.data?.[0]?.id;
  if(!fetched.ok||!itemId)throw new Error('STRIPE_SUBSCRIPTION_ITEM_MISSING');
  const updated=await stripeForm(`subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`,{'items[0][id]':itemId,'items[0][price]':price,proration_behavior:'create_prorations','metadata[workspace_id]':workspace.id,'metadata[plan]':target},{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:${target.toLowerCase()}`});
  if(!updated.ok||!active(updated.body?.status))throw new Error(`${target}_PLAN_CHANGE_FAILED`);
  return {action:`CHANGED_TO_${target}`};
}
async function scheduleCancel({subscription,deploymentRef,env,fetchImpl}){
  if(!active(subscription?.status)||String(subscription?.plan||'').toUpperCase()!=='LAUNCH'||!subscription?.provider_subscription_id)throw new Error('EXPECTED_LAUNCH_ACTIVE');
  if(subscription.cancel_at_period_end)return {action:'CANCEL_ALREADY_SCHEDULED'};
  const updated=await stripeForm(`subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`,{cancel_at_period_end:'true'},{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:cancel`});
  if(!updated.ok||updated.body?.cancel_at_period_end!==true)throw new Error('CANCEL_SCHEDULE_FAILED');
  return {action:'CANCEL_SCHEDULED'};
}
async function endSubscription({subscription,deploymentRef,env,fetchImpl}){
  if(!subscription?.provider_subscription_id||!active(subscription?.status)||String(subscription?.plan||'').toUpperCase()!=='LAUNCH'||subscription.cancel_at_period_end!==true)throw new Error('EXPECTED_CANCEL_SCHEDULED_LAUNCH');
  const ended=await stripeForm(`subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`,null,{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:end`,method:'DELETE'});
  if(!ended.ok||String(ended.body?.status||'').toLowerCase()!=='canceled')throw new Error('SUBSCRIPTION_END_FAILED');
  return {action:'ENDED_TEST_SUBSCRIPTION'};
}
async function recoverToFree({workspace,subscription,deploymentRef,env,fetchImpl}){
  if(!active(subscription?.status)){
    return {action:String(workspace.plan||'').toUpperCase()==='FREE'?'SANDBOX_ALREADY_FREE':'WAITING_FOR_WEBHOOK'};
  }
  const subscriptionId=text(subscription?.provider_subscription_id);
  if(!subscriptionId)throw new Error('RECOVERY_SUBSCRIPTION_ID_MISSING');
  const remote=await jsonFetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}},fetchImpl);
  if(!remote.ok)throw new Error('RECOVERY_REMOTE_STATE_UNAVAILABLE');
  if(String(remote.body?.status||'').toLowerCase()==='canceled')return {action:'WAITING_FOR_WEBHOOK'};
  if(!active(remote.body?.status))throw new Error('RECOVERY_REMOTE_STATE_UNEXPECTED');
  const ended=await stripeForm(`subscriptions/${encodeURIComponent(subscriptionId)}`,null,{env,fetchImpl,idempotencyKey:`mpr-e2e:${deploymentRef}:recover:${subscriptionId}`,method:'DELETE'});
  if(!ended.ok||String(ended.body?.status||'').toLowerCase()!=='canceled')throw new Error('RECOVERY_SUBSCRIPTION_END_FAILED');
  return {action:'RECOVERY_END_REQUESTED'};
}

export function createBillingE2eSandboxTransitionHandler({fetch:fetchImpl=fetch,env=process.env,authorize=authorizeReadinessRequest}={}){
  return async request=>{
    try{
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anonKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const service=text(env.SUPABASE_SERVICE_ROLE_KEY);
      const authorization=await authorize({request,env,fetchImpl,supabaseUrl,anonKey});
      if(!authorization.ok)return authorization.response;
      if(authorization.principal!=='GITHUB_ACTIONS_OIDC')return safeError('OIDC_REQUIRED','Sandbox billing transitions are restricted to the release workflow.',403);
      if(request.method!=='POST')return new Response(null,{status:405,headers:RESPONSE_HEADERS});
      if(!text(env.STRIPE_SECRET_KEY).startsWith('sk_test_'))return safeError('SANDBOX_ONLY','Stripe Test Mode is required.',409);
      if(!service||!supabaseUrl)return safeError('TRANSITION_NOT_CONFIGURED','Sandbox transition storage is not configured.',503);
      const deploymentRef=text(request.headers.get('x-mpr-deployment-ref'));
      if(!GITHUB_SHA_RE.test(deploymentRef))return safeError('DEPLOYMENT_REF_REQUIRED','A full workflow commit SHA is required.',400);
      const body=await request.json().catch(()=>({}));
      const action=text(body.action).toUpperCase();
      const workspace=await resolveWorkspace({supabaseUrl,service,env,fetchImpl});
      if(!workspace)return safeError('SANDBOX_WORKSPACE_NOT_FOUND','Dedicated sandbox workspace is unavailable.',503);
      const subscriptionState=await loadSubscription({supabaseUrl,service,workspaceId:workspace.id,fetchImpl});
      if(!subscriptionState.ok)return safeError('SUBSCRIPTION_STATE_UNAVAILABLE','Verified sandbox subscription state is unavailable.',502);
      const subscription=subscriptionState.row;

      if(action==='RECOVER_FREE'){
        const outcome=await recoverToFree({workspace,subscription,deploymentRef,env,fetchImpl});
        return Response.json({ok:true,action:outcome.action,realMoney:false,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY',recovery:true},{headers:RESPONSE_HEADERS});
      }

      const stage=text(body.stage).toUpperCase();
      if(!['DISCOVER_ACTIVE','RADAR_ACTIVE','LAUNCH_ACTIVE','CANCEL_SCHEDULED','ENDED_FREE'].includes(stage))return safeError('INVALID_STAGE','Unsupported sandbox transition stage.',400);
      const ledger=await loadAcceptance({supabaseUrl,service,workspaceId:workspace.id,deploymentRef,fetchImpl});
      if(!ledger)return safeError('ACCEPTANCE_NOT_STARTED','Current deployment billing acceptance is not started.',409);
      if(ledger.status==='GO')return safeError('ACCEPTANCE_ALREADY_GO','Current deployment billing acceptance is already complete.',409);
      if(expectedStage(ledger)!==stage)return safeError('STAGE_OUT_OF_ORDER',`Expected ${expectedStage(ledger)||'no further stage'}.`,409);
      let outcome;
      if(stage==='DISCOVER_ACTIVE')outcome=await createDiscover({workspace,subscription,deploymentRef,env,fetchImpl});
      else if(stage==='RADAR_ACTIVE'||stage==='LAUNCH_ACTIVE')outcome=await changePlan({stage,workspace,subscription,deploymentRef,env,fetchImpl});
      else if(stage==='CANCEL_SCHEDULED')outcome=await scheduleCancel({subscription,deploymentRef,env,fetchImpl});
      else outcome=await endSubscription({subscription,deploymentRef,env,fetchImpl});
      return Response.json({ok:true,stage,action:outcome.action,realMoney:false,stripeMode:'SANDBOX',entitlementAuthority:'WEBHOOK_ONLY'},{headers:RESPONSE_HEADERS});
    }catch(error){
      const code=text(error?.message)||'TRANSITION_FAILED';
      return safeError(code,'Stripe sandbox transition failed.',409);
    }
  };
}

export default createBillingE2eSandboxTransitionHandler();
export const config={path:'/api/internal/billing-e2e-sandbox-transition',method:'POST'};
