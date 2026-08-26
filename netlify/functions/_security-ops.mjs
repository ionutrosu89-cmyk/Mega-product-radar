import {createHash,randomUUID} from 'node:crypto';
import {SAAS_CONFIG} from '../../saas-config.js';

const localBuckets=new Map();
const text=v=>String(v??'').trim();
const nowMs=()=>Date.now();

function clientIp(request){return text(request?.headers?.get?.('x-nf-client-connection-ip')||request?.headers?.get?.('x-forwarded-for')?.split(',')[0]||'unknown');}
function hashIp(ip,env){const salt=text(env.SECURITY_AUDIT_SALT||env.STRIPE_WEBHOOK_SECRET||'mpr');return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0,32);}
export function requestId(request){return text(request?.headers?.get?.('x-request-id'))||randomUUID();}

export async function enforceRateLimit(request,{route,workspaceId=null,userId=null,limit=60,windowSeconds=60,env=process.env,fetchImpl=fetch}={}){
  const subject=text(userId||workspaceId||clientIp(request)||'anonymous');
  const key=`${route||'route'}:${subject}`;
  const now=nowMs(),windowMs=Math.max(1,Number(windowSeconds)||60)*1000;
  const prior=(localBuckets.get(key)||[]).filter(t=>now-t<windowMs);
  if(prior.length>=limit)return {ok:false,status:429,retryAfterSeconds:Math.max(1,Math.ceil((windowMs-(now-prior[0]))/1000)),code:'RATE_LIMITED'};
  prior.push(now);localBuckets.set(key,prior);

  // Optional durable event ledger. The in-process limiter remains active even when service-role access is unavailable.
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl,service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(supabaseUrl&&service){
    try{await fetchImpl(`${supabaseUrl}/rest/v1/api_rate_limit_events`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'return=minimal'},body:JSON.stringify({bucket_key:key,route:route||'unknown'})});}catch{}
  }
  return {ok:true,remaining:Math.max(0,limit-prior.length)};
}

export async function recordSecurityAudit({request,eventType,workspaceId=null,userId=null,actorRole=null,metadata={}}, {env=process.env,fetchImpl=fetch}={}){
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl,service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!service)return false;
  try{
    const response=await fetchImpl(`${supabaseUrl}/rest/v1/security_audit_events`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'return=minimal'},body:JSON.stringify({workspace_id:workspaceId||null,user_id:userId||null,event_type:String(eventType||'UNKNOWN'),actor_role:actorRole||null,request_id:requestId(request),ip_hash:hashIp(clientIp(request),env),metadata:metadata||{}})});
    return response.ok;
  }catch{return false;}
}
