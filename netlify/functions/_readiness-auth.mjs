import {timingSafeEqual} from 'node:crypto';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization'};

function response(error,status){return Response.json({ok:false,error},{status,headers:RESPONSE_HEADERS});}
function bearerToken(request){
  const auth=request.headers.get('authorization')||'';
  const match=/^Bearer\s+(\S+)$/i.exec(auth.trim());
  return match?.[1]||'';
}
function secureEqual(left,right){
  const a=Buffer.from(String(left||''));
  const b=Buffer.from(String(right||''));
  return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);
}
async function jsonFetch(url,options,fetchImpl){
  const result=await fetchImpl(url,options);
  let body={};
  try{body=await result.json();}catch{}
  return {ok:result.ok,status:result.status,body};
}

export async function authorizeReadinessRequest({request,env={},fetchImpl=fetch,supabaseUrl,anonKey}={}){
  const token=bearerToken(request);
  if(!token)return {ok:false,response:response('Authentication required',401)};

  const probeToken=String(env.MPR_READINESS_PROBE_TOKEN||'').trim();
  if(probeToken&&secureEqual(token,probeToken))return {ok:true,principal:'READINESS_PROBE'};

  if(!supabaseUrl||!anonKey)return {ok:false,response:response('Supabase access is not configured',503)};
  const auth=`Bearer ${token}`;
  const userCheck=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anonKey,authorization:auth}},fetchImpl);
  if(!userCheck.ok)return {ok:false,response:response('Invalid or expired session',401)};
  const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  if(!allowed.length)return {ok:false,response:response('Admin allowlist is not configured',503)};
  if(!allowed.includes(String(userCheck.body?.email||'').toLowerCase()))return {ok:false,response:response('Admin access required',403)};
  return {ok:true,principal:'ADMIN_USER'};
}

export {bearerToken,secureEqual};
