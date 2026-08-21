import {createHmac,timingSafeEqual} from 'node:crypto';
import {SAAS_CONFIG} from '../../saas-config.js';

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

async function supabaseWrite(path,{method='POST',body,env,fetchImpl}){
  const url=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('Supabase service role is not configured');
  const response=await fetchImpl(`${url}/rest/v1/${path}`,{method,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'return=minimal,resolution=merge-duplicates'},body:body?JSON.stringify(body):undefined});
  if(!response.ok)throw new Error(`Supabase billing update failed: ${response.status}`);
}

function grantedPlan(subscription){
  const metadata=subscription?.metadata||{};
  const requested=String(metadata.plan||'FREE').toUpperCase();
  const status=String(subscription?.status||'unknown').toLowerCase();
  if(!['active','trialing'].includes(status))return 'FREE';
  return ['DISCOVER','RADAR','LAUNCH'].includes(requested)?requested:'FREE';
}

async function applySubscription(subscription,{env,fetchImpl}){
  const metadata=subscription?.metadata||{};
  const workspaceId=metadata.workspace_id;
  if(!workspaceId)return;
  const status=String(subscription?.status||'unknown');
  const plan=grantedPlan(subscription);
  await supabaseWrite(`workspaces?id=eq.${encodeURIComponent(workspaceId)}`,{method:'PATCH',body:{plan},env,fetchImpl});
  await supabaseWrite('subscriptions?on_conflict=workspace_id',{method:'POST',body:{workspace_id:workspaceId,provider:'STRIPE',provider_customer_id:String(subscription.customer||''),provider_subscription_id:String(subscription.id||''),plan,status,current_period_end:subscription.current_period_end?new Date(subscription.current_period_end*1000).toISOString():null,cancel_at_period_end:Boolean(subscription.cancel_at_period_end),updated_at:new Date().toISOString()},env,fetchImpl});
}

async function applyCheckoutSession(session){
  const workspaceId=session?.metadata?.workspace_id||session?.client_reference_id;
  const plan=String(session?.metadata?.plan||'FREE').toUpperCase();
  if(!workspaceId||!['DISCOVER','RADAR','LAUNCH'].includes(plan))return;
  // Checkout completion is only a receipt signal. Subscription lifecycle events are the
  // sole source of truth for entitlement and subscription state, so this handler must
  // never overwrite an active subscription if Stripe delivers events out of order.
  return;
}

export function createBillingWebhookHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!env.STRIPE_WEBHOOK_SECRET||!env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Billing webhook not configured',{status:503});
      const raw=await request.text();
      if(!verifySignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return new Response('Invalid signature',{status:400});
      const event=JSON.parse(raw);
      if(event.type==='checkout.session.completed')await applyCheckoutSession(event.data?.object||{});
      if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))await applySubscription(event.data?.object||{},{env,fetchImpl});
      return Response.json({received:true},{headers:{'Cache-Control':'no-store'}});
    }catch(error){
      return Response.json({received:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});
    }
  };
}

export {verifySignature,grantedPlan};
export default createBillingWebhookHandler();
export const config={path:'/api/billing/webhook',method:'POST'};
