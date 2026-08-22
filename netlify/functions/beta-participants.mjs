import {SAAS_CONFIG} from '../../saas-config.js';

async function jsonFetch(url,options,fetchImpl){const r=await fetchImpl(url,options);let body={};try{body=await r.json();}catch{}return {ok:r.ok,status:r.status,body};}
async function adminState(request,{fetchImpl,env}){
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+/i.test(auth))return {error:'Authentication required',status:401};
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl,anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey,service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!service)return {error:'Supabase service role is not configured',status:503};
  const user=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anon,authorization:auth}},fetchImpl);
  if(!user.ok)return {error:'Invalid or expired session',status:401};
  const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!allowed.includes(String(user.body?.email||'').toLowerCase()))return {error:'Admin access required',status:403};
  return {supabaseUrl,service,user:user.body,headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',accept:'application/json'}};
}
const validStatus=new Set(['INVITED','ACTIVATED','COMPLETED','PAUSED']);
function aggregate(participants=[],feedback=[]){
  const statuses={INVITED:0,ACTIVATED:0,COMPLETED:0,PAUSED:0};for(const p of participants)statuses[p.status]=(statuses[p.status]||0)+1;
  const ratings=feedback.map(x=>Number(x.rating)).filter(Number.isFinite);const avgRating=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length*10)/10:null;
  const wouldPay={YES:0,NO:0,UNKNOWN:0};for(const f of feedback)f.would_pay===true?wouldPay.YES++:f.would_pay===false?wouldPay.NO++:wouldPay.UNKNOWN++;
  const byArea={};for(const f of feedback)byArea[f.area]=(byArea[f.area]||0)+1;
  return {participants:participants.length,statuses,feedbackCount:feedback.length,avgRating,wouldPay,byArea};
}
export function createBetaParticipantsHandler({fetch:fetchImpl=fetch,env=process.env}={}){return async request=>{try{
  const admin=await adminState(request,{fetchImpl,env});if(admin.error)return Response.json({ok:false,error:admin.error},{status:admin.status});
  const base=admin.supabaseUrl,h=admin.headers;
  if(request.method==='GET'){
    const [pRes,fRes]=await Promise.all([
      jsonFetch(`${base}/rest/v1/beta_participants?select=id,email,status,notes,invited_at,activated_at,completed_at,updated_at&order=created_at.desc&limit=500`,{headers:h},fetchImpl),
      jsonFetch(`${base}/rest/v1/beta_feedback?select=workspace_id,rating,area,would_pay,created_at&order=created_at.desc&limit=2000`,{headers:h},fetchImpl)
    ]);
    if(!pRes.ok||!fRes.ok)return Response.json({ok:false,error:'Beta operations data unavailable'},{status:502});
    return Response.json({ok:true,summary:aggregate(pRes.body,fRes.body),participants:pRes.body},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
  }
  if(request.method==='POST'){
    const body=await request.json().catch(()=>({}));const email=String(body.email||'').trim().toLowerCase();const status=String(body.status||'INVITED').toUpperCase();
    if(!email||!/^\S+@\S+\.\S+$/.test(email))return Response.json({ok:false,error:'Valid email required'},{status:400});
    if(!validStatus.has(status))return Response.json({ok:false,error:'Invalid beta status'},{status:400});
    const now=new Date().toISOString();const row={email,status,notes:String(body.notes||'').slice(0,1000)||null,updated_at:now};
    if(status==='ACTIVATED')row.activated_at=now;if(status==='COMPLETED')row.completed_at=now;
    const r=await jsonFetch(`${base}/rest/v1/beta_participants?on_conflict=email`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)},fetchImpl);
    if(!r.ok)return Response.json({ok:false,error:'Beta participant save failed'},{status:502});
    return Response.json({ok:true,participant:Array.isArray(r.body)?r.body[0]:r.body},{headers:{'Cache-Control':'private, no-store'}});
  }
  return new Response(null,{status:405});
}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}};}
export {aggregate};
export default createBetaParticipantsHandler();
export const config={path:'/api/internal/beta-participants'};
