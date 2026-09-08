import {SAAS_CONFIG} from '../../saas-config.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit,recordSecurityAudit} from './_security-ops.mjs';

const ALLOWED_TYPES=new Set(['ACCESS','PORTABILITY','ERASURE','RESTRICTION','OBJECTION']);
const text=value=>String(value??'').trim();

export function createPrivacyRequestHandler({fetch:fetchImpl=fetch,env=process.env,accessImpl=resolveWorkspaceAccess,rateLimitImpl=enforceRateLimit,auditImpl=recordSecurityAudit}={}){
  return async request=>{
    if(request.method!=='POST')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
    try{
      const access=await accessImpl(request,{fetchImpl,env,allowedRoles:['OWNER','ADMIN','MEMBER'],requireWorkspace:true});
      if(access?.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status||403,headers:{'Cache-Control':'no-store'}});

      const rate=await rateLimitImpl(request,{route:'privacy-request',workspaceId:access.workspaceId,userId:access.user.id,limit:5,windowSeconds:3600,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many privacy requests',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});

      const body=await request.json().catch(()=>({}));
      const requestType=text(body?.requestType).toUpperCase();
      const note=text(body?.note).slice(0,1000)||null;
      if(!ALLOWED_TYPES.has(requestType))return Response.json({ok:false,error:'Invalid privacy request type',code:'INVALID_REQUEST_TYPE'},{status:400,headers:{'Cache-Control':'no-store'}});

      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const apiKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const auth=text(request.headers.get('authorization'));
      if(!supabaseUrl||!apiKey)return Response.json({ok:false,error:'Privacy service unavailable',code:'SUPABASE_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});

      const response=await fetchImpl(`${supabaseUrl}/rest/v1/privacy_requests`,{
        method:'POST',
        headers:{apikey:apiKey,authorization:auth,'content-type':'application/json',accept:'application/json',prefer:'return=representation'},
        body:JSON.stringify({workspace_id:access.workspaceId,user_id:access.user.id,request_type:requestType,status:'OPEN',note})
      });
      if(!response.ok)return Response.json({ok:false,error:'Privacy request could not be recorded',code:'PRIVACY_REQUEST_WRITE_FAILED'},{status:502,headers:{'Cache-Control':'no-store'}});
      const row=(await response.json())?.[0]||null;
      await auditImpl({request,eventType:'PRIVACY_REQUEST_CREATED',workspaceId:access.workspaceId,userId:access.user.id,actorRole:access.membership?.role||null,metadata:{requestType,requestId:row?.id||null}},{env,fetchImpl}).catch(()=>false);
      return Response.json({ok:true,request:{id:row?.id||null,requestType,status:row?.status||'OPEN',createdAt:row?.created_at||null}},{status:201,headers:{'Cache-Control':'no-store'}});
    }catch(error){return Response.json({ok:false,error:'Privacy request failed',code:'PRIVACY_REQUEST_FAILED'},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createPrivacyRequestHandler();
export const config={path:'/api/privacy/request',method:'POST'};
