import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';

const EXPORT_TABLES=['workspaces','workspace_members','discovery_candidates','suppliers','supplier_offers','landed_costs','purchases','portfolio_items','feedback_events','subscriptions','usage_events','privacy_requests'];

async function context(){const client=await getSupabaseClient(),session=await getCurrentSession();if(!client||!session)throw new Error('Autentificare necesara.');const workspace=await ensurePersonalWorkspace('My Radar');return{client,session,workspace};}

export async function exportMyData(){
  const {client,session,workspace}=await context();
  const data={generatedAt:new Date().toISOString(),user:{id:session.user.id,email:session.user.email||null},workspace:{id:workspace.id,name:workspace.name,plan:workspace.plan},datasets:{}};
  const profile=await client.from('profiles').select('*').eq('id',session.user.id);if(profile.error)throw profile.error;data.datasets.profiles=profile.data||[];
  for(const table of EXPORT_TABLES){let q=client.from(table).select('*');if(table==='workspaces')q=q.eq('id',workspace.id);else if(table==='privacy_requests')q=q.eq('workspace_id',workspace.id).eq('user_id',session.user.id);else q=q.eq('workspace_id',workspace.id);const {data:rows,error}=await q;if(error)throw error;data.datasets[table]=rows||[];}
  return data;
}

export function downloadJson(data,filename='mega-product-radar-data-export.json'){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function submitPrivacyRequest(requestType,note=''){
  const allowed=['ACCESS','PORTABILITY','RECTIFICATION','ERASURE','RESTRICTION','OBJECTION'];if(!allowed.includes(requestType))throw new Error('Tip cerere invalid.');
  const {client,session,workspace}=await context();
  const {data,error}=await client.from('privacy_requests').insert({workspace_id:workspace.id,user_id:session.user.id,request_type:requestType,note:String(note||'').slice(0,2000)}).select('id,status,request_type,created_at').single();if(error)throw error;return data;
}

export async function listPrivacyRequests(){const {client,session,workspace}=await context();const {data,error}=await client.from('privacy_requests').select('id,request_type,status,created_at,updated_at').eq('workspace_id',workspace.id).eq('user_id',session.user.id).order('created_at',{ascending:false});if(error)throw error;return data||[];}
