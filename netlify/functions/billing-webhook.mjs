import {createHmac,timingSafeEqual} from 'node:crypto';
import {SAAS_CONFIG} from '../../saas-config.js';

const PLAN_RANK={FREE:0,DISCOVER:1,RADAR:2,LAUNCH:3};

function verifySignature(raw,header,secret,toleranceSeconds=300){
  const parts=String(header||'').split(',').map(x=>x.trim());
  const timestamp=parts.find(x=>x.startsWith('t='))?.slice(2)||'';
  const signatures=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));
  if(!timestamp||!signatures.length)return false;
  const age=Math.abs(Date.now()/1000-Number(timestamp));
  if(!Number.isFinite(age)||age>toleranceSeconds)return false;
  const expected=createHmac('sha256',secret).update(`${timestamp}.${raw}`,'utf8').digest('hex');
  const expectedBuffer=Buffer.from(expected,'utf8');
  return signatures.some(sig=>{try{const candidate=Buffer.from(sig,'utf8');return candidate.length===expectedBuffer.length&&timingSafeEqual(candidate,expectedBuffer);}catch{return false;}});
}

async function supabaseRequest(path,{method='GET',body,env,fetchImpl,prefer='return=minimal'}){
  const url=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('Supabase service role is not configured');
  const response=await fetchImpl(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',accept:'application/json',prefer},body:body?JSON.stringify(body):undefined});
  if(!response.ok)throw new Error(`Supabase billing request failed: ${response.status}`);
  if(method==='GET')return response.json();
  return null;
}

async function supabaseWrite(path,{method='POST',body,env,fetchImpl}){
  return supabaseRequest(path,{method,body,env,fetchImpl,prefer:'return=minimal,resolution=merge-duplicates'});
}

async function workspaceOwner(workspaceId,{env,fetchImpl}){
  if(!workspaceId)return null;
  const rows=await supabaseRequest(`workspaces?select=owner_id,plan&id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{env,fetchImpl}).catch(()=>[]);
  return Array.isArray(rows)?rows[0]||null:null;
}

async function existingSubscription(workspaceId,{env,fetchImpl}){
  if(!workspaceId)return null;
  const rows=await supabaseRequest(`subscriptions?select=plan,status,provider_subscription_id,cancel_at_period_end,current_period_end&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{env,fetchImpl}).catch(()=>[]);
  return Array.isArray(rows)?rows[0]||null:null;
}

async function recordJourneyEvent(workspaceId,eventName,metadata,{env,fetchImpl,plan='FREE'}){
  try{
    const owner=await workspaceOwner(workspaceId,{env,fetchImpl});
    if(!owner?.owner_id)return false;
    await supabaseWrite('journey_events',{body:{workspace_id:workspaceId,user_id:owner.owner_id,event_name:eventName,plan:String(plan||owner.plan||'FREE').toUpperCase(),page:'/api/billing/webhook',metadata:metadata||{}},env,fetchImpl});
    return true;
  }catch{return false;}
}

function grantedPlan(subscription){
  const metadata=subscription?.metadata||{};
  const requested=String(metadata.plan||'FREE').toUpperCase();
  const status=String(subscription?.status||'unknown').toLowerCase();
  if(!['active','trialing'].includes(status))return 'FREE';
  return ['DISCOVER','RADAR','LAUNCH'].includes(requested)?requested:'FREE';
}

function subscriptionPeriodEnd(subscription){
  const direct=Number(subscription?.current_period_end);
  if(Number.isFinite(direct)&&direct>0)return direct;
  const ends=(subscription?.items?.data||[]).map(item=>Number(item?.current_period_end)).filter(value=>Number.isFinite(value)&&value>0);
  return ends.length?Math.max(...ends):null;
}

function planChangeDirection(previousPlan,nextPlan){
  const before=PLAN_RANK[String(previousPlan||'FREE').toUpperCase()]??0;
  const after=PLAN_RANK[String(nextPlan||'FREE').toUpperCase()]??0;
  return after>before?'UPGRADE':after<before?'DOWNGRADE':'UNCHANGED';
}

async function applySubscription(subscription,{env,fetchImpl,eventType}){
  const metadata=subscription?.metadata||{};
  const workspaceId=metadata.workspace_id;
  if(!workspaceId)return;
  const status=String(subscription?.status||'unknown');
  const plan=grantedPlan(subscription);
  const periodEnd=subscriptionPeriodEnd(subscription);
  const previous=await existingSubscription(workspaceId,{env,fetchImpl});
  const previousPlan=String(previous?.plan||'').toUpperCase();
  const previousCancelAtPeriodEnd=Boolean(previous?.cancel_at_period_end);
  const nextCancelAtPeriodEnd=Boolean(subscription.cancel_at_period_end);
  await supabaseWrite(`workspaces?id=eq.${encodeURIComponent(workspaceId)}`,{method:'PATCH',body:{plan},env,fetchImpl});
  await supabaseWrite('subscriptions?on_conflict=workspace_id',{method:'POST',body:{workspace_id:workspaceId,provider:'STRIPE',provider_customer_id:String(subscription.customer||''),provider_subscription_id:String(subscription.id||''),plan,status,current_period_end:periodEnd?new Date(periodEnd*1000).toISOString():null,cancel_at_period_end:nextCancelAtPeriodEnd,updated_at:new Date().toISOString()},env,fetchImpl});
  const active=['active','trialing'].includes(status.toLowerCase());
  if(eventType==='customer.subscription.updated'&&active&&previous){
    if(!previousCancelAtPeriodEnd&&nextCancelAtPeriodEnd){
      await recordJourneyEvent(workspaceId,'SUBSCRIPTION_CANCEL_SCHEDULED',{eventType,providerSubscriptionId:String(subscription.id||''),status,currentPeriodEnd:periodEnd?new Date(periodEnd*1000).toISOString():null},{env,fetchImpl,plan});
    }
    if(previousCancelAtPeriodEnd&&!nextCancelAtPeriodEnd){
      await recordJourneyEvent(workspaceId,'SUBSCRIPTION_CANCEL_UNSCHEDULED',{eventType,providerSubscriptionId:String(subscription.id||''),status},{env,fetchImpl,plan});
    }
  }
  if(eventType==='customer.subscription.created'&&active){
    await recordJourneyEvent(workspaceId,'SUBSCRIPTION_ACTIVATED',{eventType,providerSubscriptionId:String(subscription.id||''),status},{env,fetchImpl,plan});
    return;
  }
  if(eventType==='customer.subscription.updated'&&active&&previousPlan&&previousPlan!==plan){
    await recordJourneyEvent(workspaceId,'PLAN_CHANGED',{eventType,providerSubscriptionId:String(subscription.id||''),status,previousPlan,newPlan:plan,direction:planChangeDirection(previousPlan,plan)},{env,fetchImpl,plan});
    return;
  }
  if(eventType==='customer.subscription.updated'&&active&&!previousPlan){
    await recordJourneyEvent(workspaceId,'SUBSCRIPTION_ACTIVATED',{eventType,providerSubscriptionId:String(subscription.id||''),status,recovered:true},{env,fetchImpl,plan});
  }
}

async function applyCheckoutSession(session,{env,fetchImpl}){
  const workspaceId=session?.metadata?.workspace_id||session?.client_reference_id;
  const plan=String(session?.metadata?.plan||'FREE').toUpperCase();
  if(!workspaceId||!['DISCOVER','RADAR','LAUNCH'].includes(plan))return;
  await recordJourneyEvent(workspaceId,'CHECKOUT_COMPLETED',{stripeSessionId:String(session.id||''),paymentStatus:String(session.payment_status||''),requestedPlan:plan},{env,fetchImpl,plan});
  // Checkout completion is only a receipt signal. Subscription lifecycle events are the
  // sole source of truth for entitlement and subscription state, so this handler must
  // never overwrite an active subscription if Stripe delivers events out of order.
}

export function createBillingWebhookHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!env.STRIPE_WEBHOOK_SECRET||!env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Billing webhook not configured',{status:503});
      const raw=await request.text();
      if(!verifySignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return new Response('Invalid signature',{status:400});
      const event=JSON.parse(raw);
      if(event.type==='checkout.session.completed')await applyCheckoutSession(event.data?.object||{},{env,fetchImpl});
      if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))await applySubscription(event.data?.object||{},{env,fetchImpl,eventType:event.type});
      return Response.json({received:true},{headers:{'Cache-Control':'no-store'}});
    }catch(error){
      return Response.json({received:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {verifySignature,grantedPlan,subscriptionPeriodEnd,planChangeDirection,recordJourneyEvent};
export default createBillingWebhookHandler();
export const config={path:'/api/billing/webhook',method:'POST'};
