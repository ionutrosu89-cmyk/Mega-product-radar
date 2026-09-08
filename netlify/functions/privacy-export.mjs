import {SAAS_CONFIG} from '../../saas-config.js';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';
import {enforceRateLimit,recordSecurityAudit} from './_security-ops.mjs';

const text=value=>String(value??'').trim();

async function readRows(fetchImpl,url,headers){
  const response=await fetchImpl(url,{headers});
  if(!response.ok)throw new Error(`EXPORT_READ_${response.status}`);
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
}

export function createPrivacyExportHandler({fetch:fetchImpl=fetch,env=process.env,accessImpl=resolveWorkspaceAccess,rateLimitImpl=enforceRateLimit,auditImpl=recordSecurityAudit}={}){
  return async request=>{
    if(request.method!=='GET')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
    try{
      const access=await accessImpl(request,{fetchImpl,env,allowedRoles:['OWNER','ADMIN','MEMBER'],requireWorkspace:true});
      if(access?.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status||403,headers:{'Cache-Control':'no-store'}});
      const rate=await rateLimitImpl(request,{route:'privacy-export',workspaceId:access.workspaceId,userId:access.user.id,limit:3,windowSeconds:3600,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many exports',code:rate.code},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});

      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const apiKey=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const auth=text(request.headers.get('authorization'));
      if(!supabaseUrl||!apiKey)return Response.json({ok:false,error:'Privacy export unavailable',code:'SUPABASE_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
      const headers={apikey:apiKey,authorization:auth,accept:'application/json'};
      const q=(table,select,filters)=>`${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filters}`;
      const userId=encodeURIComponent(access.user.id);
      const workspaceId=encodeURIComponent(access.workspaceId);

      const [profile,workspace,membership,preferences,watchlist,journey,requests]=await Promise.all([
        readRows(fetchImpl,q('profiles','id,email,display_name,created_at,updated_at',`id=eq.${userId}&limit=1`),headers),
        readRows(fetchImpl,q('workspaces','id,name,slug,plan,created_at,updated_at',`id=eq.${workspaceId}&limit=1`),headers),
        readRows(fetchImpl,q('workspace_members','workspace_id,user_id,role,created_at',`workspace_id=eq.${workspaceId}&user_id=eq.${userId}&limit=1`),headers),
        readRows(fetchImpl,q('seller_preferences','workspace_id,experience_level,monthly_budget_ron,categories,marketplaces,sourcing_preference,risk_profile,goal,onboarding_completed,created_at,updated_at',`workspace_id=eq.${workspaceId}&limit=1`),headers),
        readRows(fetchImpl,q('commercial_watchlist','id,workspace_id,user_id,product_key,product_name,category,state,notes,last_acknowledged_at,created_at,updated_at',`workspace_id=eq.${workspaceId}&user_id=eq.${userId}&order=created_at.asc`),headers),
        readRows(fetchImpl,q('journey_events','id,workspace_id,user_id,event_name,plan,page,metadata,created_at',`workspace_id=eq.${workspaceId}&user_id=eq.${userId}&order=created_at.asc`),headers),
        readRows(fetchImpl,q('privacy_requests','id,workspace_id,user_id,request_type,status,note,created_at,updated_at',`workspace_id=eq.${workspaceId}&user_id=eq.${userId}&order=created_at.asc`),headers)
      ]);

      const payload={
        exportVersion:'1.0',
        generatedAt:new Date().toISOString(),
        scope:{userId:access.user.id,workspaceId:access.workspaceId},
        account:{profile:profile[0]||null,workspace:workspace[0]||null,membership:membership[0]||null,preferences:preferences[0]||null},
        userScopedData:{commercialWatchlist:watchlist,journeyEvents:journey,privacyRequests:requests},
        notice:'This self-service export contains rows that are unambiguously attributable to this user. For a full access/portability review of shared workspace telemetry, submit an ACCESS or PORTABILITY request.'
      };
      await auditImpl({request,eventType:'PRIVACY_EXPORT_GENERATED',workspaceId:access.workspaceId,userId:access.user.id,actorRole:access.membership?.role||null,metadata:{}},{env,fetchImpl}).catch(()=>false);
      return new Response(JSON.stringify(payload,null,2),{status:200,headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="mpr-data-export-${access.user.id}.json"`,'Cache-Control':'no-store','Pragma':'no-cache'}});
    }catch(error){return Response.json({ok:false,error:'Privacy export failed',code:'PRIVACY_EXPORT_FAILED'},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createPrivacyExportHandler();
export const config={path:'/api/privacy/export',method:'GET'};
