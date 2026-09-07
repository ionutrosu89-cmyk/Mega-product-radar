import {SAAS_CONFIG} from '../../saas-config.js';
import {enforceRateLimit} from './_security-ops.mjs';
import {resolveWorkspaceAccess} from './_workspace-access.mjs';

const EXPORT_TABLES=Object.freeze([
  'seller_preferences','portfolio_items','commercial_watchlist','journey_events','landed_costs',
  'supplier_offers','suppliers','purchases','test_execution_records','usage_events','beta_feedback',
  'commercial_observations','commercial_outcomes','discovery_candidates','feedback_events','products','rfq_dispatch_states'
]);
const serviceHeaders=service=>({apikey:service,authorization:`Bearer ${service}`,accept:'application/json'});
async function readJson(fetchImpl,url,headers){const r=await fetchImpl(url,{headers});if(!r.ok)throw new Error(`EXPORT_READ_FAILED:${r.status}`);return r.json();}

export function createAccountExportHandler({fetch:fetchImpl=fetch,env=process.env,now=()=>new Date()}={}){
  return async request=>{
    try{
      const rate=await enforceRateLimit(request,{route:'account-export',limit:3,windowSeconds:3600,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many export requests'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const access=await resolveWorkspaceAccess(request,{fetchImpl,env,requireWorkspace:false});
      if(access.error)return Response.json({ok:false,error:access.error,code:access.code},{status:access.status,headers:{'Cache-Control':'no-store'}});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const service=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!supabaseUrl||!service)return Response.json({ok:false,error:'Export service unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
      const headers=serviceHeaders(service);
      const uid=encodeURIComponent(access.user.id);
      const profile=(await readJson(fetchImpl,`${supabaseUrl}/rest/v1/profiles?select=*&id=eq.${uid}`,headers))||[];
      const memberships=(await readJson(fetchImpl,`${supabaseUrl}/rest/v1/workspace_members?select=*&user_id=eq.${uid}`,headers))||[];
      const workspaceIds=[...new Set(memberships.map(row=>row.workspace_id).filter(Boolean))];
      const workspaces=workspaceIds.length?await readJson(fetchImpl,`${supabaseUrl}/rest/v1/workspaces?select=*&id=in.(${workspaceIds.map(id=>encodeURIComponent(id)).join(',')})`,headers):[];
      const data={};
      for(const table of EXPORT_TABLES){
        if(!workspaceIds.length){data[table]=[];continue;}
        const filter=workspaceIds.map(id=>encodeURIComponent(id)).join(',');
        try{data[table]=await readJson(fetchImpl,`${supabaseUrl}/rest/v1/${table}?select=*&workspace_id=in.(${filter})`,headers);}catch{data[table]=[{export_status:'UNAVAILABLE'}];}
      }
      const payload={
        schema:'MPR_ACCOUNT_EXPORT_V1',
        exportedAt:now().toISOString(),
        account:{id:access.user.id,email:access.user.email||null,createdAt:access.user.created_at||null},
        profile,
        memberships,
        workspaces,
        workspaceData:data,
        notes:['Security audit logs, server secrets and data belonging to other users are excluded.','Unavailable optional tables are marked UNAVAILABLE rather than silently omitted.']
      };
      return new Response(JSON.stringify(payload,null,2),{status:200,headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="mega-product-radar-account-export.json"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
    }catch{return Response.json({ok:false,error:'Account export failed'},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createAccountExportHandler();
export const config={path:'/api/account/export',method:'GET'};
