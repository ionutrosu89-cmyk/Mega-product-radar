import {SAAS_CONFIG} from '../../saas-config.js';

function billingEventsUrl(eventId,env,status){
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const filters=[`stripe_event_id=eq.${encodeURIComponent(eventId)}`];
  if(status)filters.push(`status=eq.${encodeURIComponent(status)}`);
  return `${supabaseUrl}/rest/v1/billing_webhook_events?${filters.join('&')}`;
}

function serviceHeaders(env,prefer='return=minimal'){
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)throw new Error('Supabase service role is not configured');
  return {apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',accept:'application/json',prefer};
}

async function readExistingStatus(eventId,{env,fetchImpl}){
  const response=await fetchImpl(`${billingEventsUrl(eventId,env)}&select=status&limit=1`,{
    headers:serviceHeaders(env)
  });
  if(!response.ok)throw new Error(`Webhook idempotency lookup failed: ${response.status}`);
  const rows=await response.json().catch(()=>[]);
  return Array.isArray(rows)?String(rows[0]?.status||'').toUpperCase():'';
}

async function retryFailedClaim(eventId,{env,fetchImpl}){
  const response=await fetchImpl(billingEventsUrl(eventId,env,'FAILED'),{
    method:'PATCH',
    headers:serviceHeaders(env,'return=representation'),
    body:JSON.stringify({status:'PROCESSING',processed_at:null,last_error:null})
  });
  if(!response.ok)throw new Error(`Webhook retry claim failed: ${response.status}`);
  const rows=await response.json().catch(()=>[]);
  return Array.isArray(rows)&&rows.length>0;
}

export async function claimWebhookEvent(event,{env,fetchImpl}){
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const response=await fetchImpl(`${supabaseUrl}/rest/v1/billing_webhook_events`,{
    method:'POST',
    headers:serviceHeaders(env),
    body:JSON.stringify({stripe_event_id:event.id,event_type:event.type,status:'PROCESSING'})
  });
  if(response.ok)return true;
  if(response.status!==409)throw new Error(`Webhook idempotency claim failed: ${response.status}`);

  const status=await readExistingStatus(event.id,{env,fetchImpl});
  if(status!=='FAILED')return false;

  // Stripe retries reuse the same event id. A previous transient failure must be
  // reclaimable, but the conditional FAILED -> PROCESSING update prevents two
  // concurrent deliveries from both owning the retry.
  return retryFailedClaim(event.id,{env,fetchImpl});
}

export {readExistingStatus,retryFailedClaim};
