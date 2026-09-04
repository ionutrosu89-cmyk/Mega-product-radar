import {createHash,randomUUID} from 'node:crypto';
import {SAAS_CONFIG} from '../../saas-config.js';

const localBuckets=new Map();
const text=v=>String(v??'').trim();
const nowMs=()=>Date.now();
const isProduction=env=>text(env?.CONTEXT).toLowerCase()==='production'||text(env?.MPR_ENV).toLowerCase()==='production';

function clientIp(request){return text(request?.headers?.get?.('x-nf-client-connection-ip')||request?.headers?.get?.('x-forwarded-for')?.split(',')[0]||'unknown');}
export function securityAuditSalt(env=process.env){
  const salt=text(env?.SECURITY_AUDIT_SALT);
  if(salt.length>=32)return salt;
  if(isProduction(env))throw new Error('SECURITY_AUDIT_SALT_REQUIRED');
  return 'mpr-local-development-only';
}
function hashIp(ip,env){return createHash('sha256').update(`${securityAuditSalt(env)}:${ip}`).digest('hex').slice(0,32);}
export function requestId(request){return text(request?.headers?.get?.('x-request-id'))||randomUUID();}

function localRateLimit(key,limit,windowSeconds){const now=nowMs(),windowMs=Math.max(1,Number(windowSeconds)||60)*1000;const prior=(localBuckets.get(key)||[]).filter(t=>now-t<windowMs);if(prior.length>=limit)return {ok:false,status:429,retryAfterSeconds:Math.max(1,Math.ceil((windowMs-(now-prior[0]))/1000)),code:'RATE_LIMITED',mode:'LOCAL_FALLBACK'};prior.push(now);localBuckets.set(key,prior);return {ok:true,remaining:Math.max(0,limit-prior.length),mode:'LOCAL_FALLBACK'};}

export async function enforceRateLimit(request,{route,workspaceId=null,userId=null,limit=60,windowSeconds=60,env=process.env,fetchImpl=fetch}={}){
  if(isProduction(env))securityAuditSalt(env);
  const subject=text(userId||workspaceId||hashIp(clientIp(request)||'unknown',env));
  const key=`${route||'route'}:${subject}`;
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl,service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(supabaseUrl&&service){
    try{
      const response=await fetchImpl(`${supabaseUrl}/rest/v1/rpc/consume_api_rate_limit`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({p_bucket_key:key,p_limit:Math.max(1,Number(limit)||1),p_window_seconds:Math.max(1,Number(windowSeconds)||60)})});
      if(response.ok){const row=await response.json();const value=Array.isArray(row)?row[0]:row;const allowed=value?.allowed===true;return allowed?{ok:true,remaining:Math.max(0,Number(value.limit||limit)-Number(value.hitCount||0)),mode:'DISTRIBUTED_ATOMIC'}:{ok:false,status:429,retryAfterSeconds:Math.max(1,Number(value?.retryAfterSeconds||1)),code:'RATE_LIMITED',mode:'DISTRIBUTED_ATOMIC'};}
      const fallback=localRateLimit(key,limit,windowSeconds);return {...fallback,sharedStoreError:`HTTP_${response.status}`};
    }catch(error){const fallback=localRateLimit(key,limit,windowSeconds);return {...fallback,sharedStoreError:String(error?.message||error)};}
  }
  return localRateLimit(key,limit,windowSeconds);
}

export async function recordSecurityAudit({request,eventType,workspaceId=null,userId=null,actorRole=null,metadata={}}, {env=process.env,fetchImpl=fetch}={}){
  if(isProduction(env))securityAuditSalt(env);
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl,service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!service)return false;
  try{const response=await fetchImpl(`${supabaseUrl}/rest/v1/security_audit_events`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'return=minimal'},body:JSON.stringify({workspace_id:workspaceId||null,user_id:userId||null,event_type:String(eventType||'UNKNOWN'),actor_role:actorRole||null,request_id:requestId(request),ip_hash:hashIp(clientIp(request),env),metadata:metadata||{}})});return response.ok;}catch{return false;}
}
