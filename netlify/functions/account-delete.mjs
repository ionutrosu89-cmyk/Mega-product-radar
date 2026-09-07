import {SAAS_CONFIG} from '../../saas-config.js';
import {enforceRateLimit} from './_security-ops.mjs';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';

const CONFIRMATION='DELETE MY ACCOUNT';
const serviceHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,accept:'application/json','content-type':'application/json'});
async function readJson(fetchImpl,url,headers){const r=await fetchImpl(url,{headers});if(!r.ok)throw new Error(`READ_FAILED:${r.status}`);return r.json();}

export function createAccountDeleteHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(Number(request.headers.get('content-length')||0)>4096)return Response.json({ok:false,error:'Payload too large'},{status:413});
      const rate=await enforceRateLimit(request,{route:'account-delete',limit:3,windowSeconds:3600,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many deletion attempts'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const access=await resolveWorkspaceAccess(request,{fetchImpl,env,requireWorkspace:false});
      if(access.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status,headers:{'Cache-Control':'no-store'}});
      const body=await request.json().catch(()=>null);
      if(String(body?.confirmation||'')!==CONFIRMATION)return Response.json({ok:false,error:'Explicit deletion confirmation required',code:'CONFIRMATION_REQUIRED'},{status:400,headers:{'Cache-Control':'no-store'}});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const service=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!supabaseUrl||!service)return Response.json({ok:false,error:'Deletion service unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const headers=serviceHeaders(service);
      const uid=encodeURIComponent(access.user.id);
      const owned=await readJson(fetchImpl,`${supabaseUrl}/rest/v1/workspaces?select=id,plan&owner_id=eq.${uid}`,headers);
      if(owned.length){
        const ids=owned.map(row=>encodeURIComponent(row.id)).join(',');
        const subscriptions=await readJson(fetchImpl,`${supabaseUrl}/rest/v1/subscriptions?select=workspace_id,status,cancel_at_period_end&workspace_id=in.(${ids})`,headers);
        const active=subscriptions.filter(row=>['active','trialing','past_due','incomplete','unpaid'].includes(String(row.status||'').toLowerCase()));
        if(active.length)return Response.json({ok:false,error:'Active billing must be resolved before account deletion',code:'ACTIVE_BILLING_BLOCKS_DELETION'},{status:409,headers:{'Cache-Control':'no-store'}});
      }
      const deletion=await fetchImpl(`${supabaseUrl}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers});
      if(!deletion.ok)return Response.json({ok:false,error:'Account deletion failed',code:'AUTH_DELETE_FAILED'},{status:502,headers:{'Cache-Control':'no-store'}});
      return Response.json({ok:true,deleted:true,sessionRevokedByUserDeletion:true},{status:200,headers:{'Cache-Control':'no-store','Clear-Site-Data':'"cache", "cookies", "storage"'}});
    }catch{return Response.json({ok:false,error:'Account deletion failed'},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export {CONFIRMATION};
export default createAccountDeleteHandler();
export const config={path:'/api/account/delete',method:'POST'};
