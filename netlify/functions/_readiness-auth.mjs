import {createPublicKey,timingSafeEqual,verify as verifySignature} from 'node:crypto';

const RESPONSE_HEADERS={'Cache-Control':'private, no-store','Vary':'Authorization'};
const GITHUB_OIDC_ISSUER='https://token.actions.githubusercontent.com';
const GITHUB_OIDC_JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const GITHUB_OIDC_AUDIENCE='mega-product-radar-readiness';
const GITHUB_REPOSITORY='ionutrosu89-cmyk/Mega-product-radar';
const GITHUB_REPOSITORY_ID='1329831891';
const GITHUB_REPOSITORY_OWNER_ID='315386782';
const GITHUB_MAIN_REF='refs/heads/main';
const GITHUB_ALLOWED_WORKFLOW_REFS=new Set([
  `${GITHUB_REPOSITORY}/.github/workflows/paid-beta-deployment-acceptance.yml@${GITHUB_MAIN_REF}`,
  `${GITHUB_REPOSITORY}/.github/workflows/stripe-sandbox-billing-e2e.yml@${GITHUB_MAIN_REF}`
]);
const GITHUB_ALLOWED_EVENTS=new Set(['push','workflow_dispatch']);
const CLOCK_SKEW_SECONDS=60;

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
function decodeJwtPart(part){
  try{return JSON.parse(Buffer.from(part,'base64url').toString('utf8'));}catch{return null;}
}
function githubOidcPayload(token){
  const parts=String(token||'').split('.');
  if(parts.length!==3)return null;
  return decodeJwtPart(parts[1]);
}
function audienceMatches(aud){
  return Array.isArray(aud)?aud.includes(GITHUB_OIDC_AUDIENCE):aud===GITHUB_OIDC_AUDIENCE;
}
function claimsAreAllowed(payload,nowSeconds){
  if(!payload||payload.iss!==GITHUB_OIDC_ISSUER)return false;
  if(!audienceMatches(payload.aud))return false;
  if(payload.repository!==GITHUB_REPOSITORY)return false;
  if(String(payload.repository_id||'')!==GITHUB_REPOSITORY_ID)return false;
  if(String(payload.repository_owner_id||'')!==GITHUB_REPOSITORY_OWNER_ID)return false;
  if(payload.ref!==GITHUB_MAIN_REF)return false;
  if(!GITHUB_ALLOWED_WORKFLOW_REFS.has(payload.workflow_ref))return false;
  if(!GITHUB_ALLOWED_EVENTS.has(payload.event_name))return false;
  if(!Number.isFinite(payload.exp)||payload.exp<nowSeconds-CLOCK_SKEW_SECONDS)return false;
  if(Number.isFinite(payload.nbf)&&payload.nbf>nowSeconds+CLOCK_SKEW_SECONDS)return false;
  if(!Number.isFinite(payload.iat)||payload.iat>nowSeconds+CLOCK_SKEW_SECONDS)return false;
  return true;
}

export async function verifyGitHubActionsOidcToken(token,{fetchImpl=fetch,nowMs=Date.now()}={}){
  const parts=String(token||'').split('.');
  if(parts.length!==3)return false;
  const header=decodeJwtPart(parts[0]);
  const payload=decodeJwtPart(parts[1]);
  const nowSeconds=Math.floor(nowMs/1000);
  if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid)return false;
  if(!claimsAreAllowed(payload,nowSeconds))return false;

  let jwks;
  try{
    const result=await jsonFetch(GITHUB_OIDC_JWKS_URL,{headers:{accept:'application/json'}},fetchImpl);
    if(!result.ok||!Array.isArray(result.body?.keys))return false;
    jwks=result.body.keys;
  }catch{return false;}
  const jwk=jwks.find(key=>key?.kid===header.kid&&key?.kty==='RSA');
  if(!jwk)return false;
  try{
    const key=createPublicKey({key:jwk,format:'jwk'});
    const data=Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature=Buffer.from(parts[2],'base64url');
    return verifySignature('RSA-SHA256',data,key,signature);
  }catch{return false;}
}

export async function authorizeReadinessRequest({request,env={},fetchImpl=fetch,supabaseUrl,anonKey}={}){
  const token=bearerToken(request);
  if(!token)return {ok:false,response:response('Authentication required',401)};

  const probeToken=String(env.MPR_READINESS_PROBE_TOKEN||'').trim();
  if(probeToken&&secureEqual(token,probeToken))return {ok:true,principal:'READINESS_PROBE'};

  const untrustedOidcPayload=githubOidcPayload(token);
  if(untrustedOidcPayload?.iss===GITHUB_OIDC_ISSUER){
    const valid=await verifyGitHubActionsOidcToken(token,{fetchImpl});
    if(valid)return {ok:true,principal:'GITHUB_ACTIONS_OIDC'};
    return {ok:false,response:response('Invalid readiness OIDC credential',401)};
  }

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
