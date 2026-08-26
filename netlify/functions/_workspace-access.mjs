import {SAAS_CONFIG} from '../../saas-config.js';
import {planByCode} from '../../billing-plans.js';

const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const VALID_ROLES=new Set(['OWNER','ADMIN','MEMBER']);

export function requestedWorkspaceId(request){return text(request?.headers?.get?.('x-mpr-workspace-id'))||null;}
export function workspaceRoleAllowed(role,allowedRoles=['OWNER','ADMIN','MEMBER']){const allowed=new Set((allowedRoles||[]).map(upper));return VALID_ROLES.has(upper(role))&&allowed.has(upper(role));}

export async function resolveWorkspaceAccess(request,{fetchImpl=fetch,env=process.env,allowedRoles=['OWNER','ADMIN','MEMBER'],requireWorkspace=true}={}){
  const auth=text(request?.headers?.get?.('authorization'));
  if(!/^Bearer\s+\S+/i.test(auth))return {error:'Authentication required',status:401,code:'AUTH_REQUIRED'};
  const workspaceId=requestedWorkspaceId(request);
  if(requireWorkspace&&!workspaceId)return {error:'Explicit workspace context required',status:400,code:'WORKSPACE_CONTEXT_REQUIRED'};

  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const apiKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
  if(!supabaseUrl||!apiKey)return {error:'Supabase access is not configured',status:503,code:'SUPABASE_NOT_CONFIGURED'};
  const headers={apikey:apiKey,authorization:auth,accept:'application/json'};

  const userResponse=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
  if(!userResponse.ok)return {error:'Invalid or expired session',status:401,code:'INVALID_SESSION'};
  const user=await userResponse.json();
  if(!user?.id)return {error:'Authenticated user identity unavailable',status:401,code:'USER_IDENTITY_MISSING'};
  if(!workspaceId)return {user,workspace:null,membership:null,workspaceId:null,plan:planByCode('FREE')};

  const membershipUrl=`${supabaseUrl}/rest/v1/workspace_members?select=workspace_id,user_id,role&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`;
  const membershipResponse=await fetchImpl(membershipUrl,{headers});
  if(!membershipResponse.ok)return {error:'Workspace membership lookup failed',status:502,code:'WORKSPACE_MEMBERSHIP_LOOKUP_FAILED'};
  const membership=(await membershipResponse.json())?.[0]||null;
  if(!membership)return {error:'Workspace access denied',status:403,code:'WORKSPACE_ACCESS_DENIED'};
  if(!workspaceRoleAllowed(membership.role,allowedRoles))return {error:'Workspace role is not allowed for this action',status:403,code:'WORKSPACE_ROLE_DENIED'};

  const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,name,plan,owner_id&id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers});
  if(!workspaceResponse.ok)return {error:'Workspace lookup failed',status:502,code:'WORKSPACE_LOOKUP_FAILED'};
  const workspace=(await workspaceResponse.json())?.[0]||null;
  if(!workspace)return {error:'Workspace not found',status:404,code:'WORKSPACE_NOT_FOUND'};
  return {user,workspace,membership,workspaceId:workspace.id,plan:planByCode(workspace.plan||'FREE')};
}
