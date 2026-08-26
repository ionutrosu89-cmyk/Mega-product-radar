import {SAAS_CONFIG} from '../../saas-config.js';

const OWNER_ONLY=new Set(['OWNER']);
const OWNER_ADMIN=new Set(['OWNER','ADMIN']);

export function requestedWorkspaceId(request){
  const header=String(request?.headers?.get?.('x-mpr-workspace-id')||'').trim();
  return header||null;
}

export function roleAllowed(role,mode='OWNER'){
  const normalized=String(role||'').toUpperCase();
  return (mode==='OWNER_OR_ADMIN'?OWNER_ADMIN:OWNER_ONLY).has(normalized);
}

export async function resolveBillingWorkspaceAccess(request,{fetchImpl=fetch,env=process.env,mode='OWNER'}={}){
  const auth=String(request?.headers?.get?.('authorization')||'');
  if(!/^Bearer\s+\S+/i.test(auth))return {error:'Authentication required',status:401};
  const workspaceId=requestedWorkspaceId(request);
  if(!workspaceId)return {error:'Explicit workspace context required',status:400,code:'WORKSPACE_CONTEXT_REQUIRED'};

  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
  const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
  const headers={apikey:anon,authorization:auth,accept:'application/json'};

  const userResponse=await fetchImpl(`${supabaseUrl}/auth/v1/user`,{headers});
  if(!userResponse.ok)return {error:'Invalid or expired session',status:401};
  const user=await userResponse.json();
  if(!user?.id)return {error:'Authenticated user identity unavailable',status:401};

  const membershipUrl=`${supabaseUrl}/rest/v1/workspace_members?select=workspace_id,user_id,role&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`;
  const membershipResponse=await fetchImpl(membershipUrl,{headers});
  if(!membershipResponse.ok)return {error:'Workspace membership lookup failed',status:502};
  const membership=(await membershipResponse.json())?.[0]||null;
  if(!membership)return {error:'Workspace access denied',status:403,code:'WORKSPACE_ACCESS_DENIED'};
  if(!roleAllowed(membership.role,mode))return {error:'Billing action requires workspace owner permission',status:403,code:'BILLING_OWNER_REQUIRED'};

  const workspaceResponse=await fetchImpl(`${supabaseUrl}/rest/v1/workspaces?select=id,name,plan&id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers});
  if(!workspaceResponse.ok)return {error:'Workspace lookup failed',status:502};
  const workspace=(await workspaceResponse.json())?.[0]||null;
  if(!workspace)return {error:'Workspace not found',status:404};

  const subscriptionResponse=await fetchImpl(`${supabaseUrl}/rest/v1/subscriptions?select=workspace_id,plan,status,provider_subscription_id,cancel_at_period_end,current_period_end&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`,{headers});
  const subscription=subscriptionResponse.ok?(await subscriptionResponse.json())?.[0]||null:null;
  if(!subscriptionResponse.ok)return {error:'Subscription lookup failed',status:502};

  return {user,workspace,membership,subscription,workspaceId};
}
