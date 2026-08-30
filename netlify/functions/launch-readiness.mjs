import {SAAS_CONFIG} from '../../saas-config.js';
import {verifyBillingJourneyEvidence} from '../../scripts/verify-billing-journey-evidence.mjs';

export const REQUIRED_CHECKS=Object.freeze([
  'LEGAL_OPERATOR','LEGAL_TERMS','PRIVACY_GDPR','SUPPORT_REFUNDS','DOMAIN_BRAND','BILLING_E2E','EXTERNAL_BETA','INCIDENT_ROLLBACK'
]);
const STATUS=new Set(['BLOCKED','IN_REVIEW','PASS']);
async function jsonFetch(url,options,fetchImpl){const r=await fetchImpl(url,options);let body={};try{body=await r.json();}catch{}return {ok:r.ok,status:r.status,body};}
async function adminState(request,{fetchImpl,env}){
  const auth=request.headers.get('authorization')||'';if(!/^Bearer\s+\S+/i.test(auth))return {error:'Authentication required',status:401};
  const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl,anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey,service=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!service)return {error:'Supabase service role is not configured',status:503};
  const user=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anon,authorization:auth}},fetchImpl);if(!user.ok)return {error:'Invalid or expired session',status:401};
  const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!allowed.includes(String(user.body?.email||'').toLowerCase()))return {error:'Admin access required',status:403};
  return {supabaseUrl,service,user:user.body,headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',accept:'application/json'}};
}
export function summarize(rows=[]){const map=new Map(rows.map(r=>[r.check_code,r]));const checks=REQUIRED_CHECKS.map(code=>{const row=map.get(code)||{};return {checkCode:code,status:STATUS.has(row.status)?row.status:'BLOCKED',evidenceNote:row.evidence_note||null,verifiedAt:row.verified_at||null};});return {checks,passed:checks.filter(x=>x.status==='PASS').length,total:REQUIRED_CHECKS.length,allManualPassed:checks.every(x=>x.status==='PASS')};}

export function launchPassEvidence(checkCode,body={}){
  if(checkCode!=='BILLING_E2E')return {ok:true,note:String(body.evidenceNote||'').trim().slice(0,2000)};
  const verdict=verifyBillingJourneyEvidence(body.billingJourneyEvidence||{});
  if(!verdict.ok)return {ok:false,error:'Verified sandbox billing journey evidence is required before BILLING_E2E can PASS',verdict};
  const workspaceId=String(body.billingJourneyEvidence?.workspaceId||'').trim();
  return {ok:true,note:`MPR_BILLING_JOURNEY_EVIDENCE_VERDICT_V1 GO; workspace=${workspaceId}`.slice(0,2000),verdict};
}

export function createLaunchReadinessHandler({fetch:fetchImpl=fetch,env=process.env}={}){return async request=>{try{
  const admin=await adminState(request,{fetchImpl,env});if(admin.error)return Response.json({ok:false,error:admin.error},{status:admin.status});const base=admin.supabaseUrl,h=admin.headers;
  if(request.method==='GET'){
    const r=await jsonFetch(`${base}/rest/v1/launch_readiness_checks?select=check_code,status,evidence_note,verified_at&limit=100`,{headers:h},fetchImpl);if(!r.ok)return Response.json({ok:false,error:'Launch readiness unavailable'},{status:502});return Response.json({ok:true,...summarize(Array.isArray(r.body)?r.body:[])},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
  }
  if(request.method==='POST'){
    const body=await request.json().catch(()=>({}));const checkCode=String(body.checkCode||'').toUpperCase(),status=String(body.status||'').toUpperCase();
    if(!REQUIRED_CHECKS.includes(checkCode))return Response.json({ok:false,error:'Unknown launch check'},{status:400});if(!STATUS.has(status))return Response.json({ok:false,error:'Invalid launch status'},{status:400});
    const evidence=status==='PASS'?launchPassEvidence(checkCode,body):{ok:true,note:String(body.evidenceNote||'').trim().slice(0,2000)};
    if(!evidence.ok)return Response.json({ok:false,error:evidence.error,journeyVerdict:evidence.verdict},{status:400});
    const note=String(evidence.note||'').trim().slice(0,2000);if(status==='PASS'&&note.length<8)return Response.json({ok:false,error:'Evidence note required before PASS'},{status:400});
    const now=new Date().toISOString(),row={check_code:checkCode,status,evidence_note:note||null,updated_at:now,verified_by:status==='PASS'?admin.user.id:null,verified_at:status==='PASS'?now:null};
    const r=await jsonFetch(`${base}/rest/v1/launch_readiness_checks?on_conflict=check_code`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)},fetchImpl);if(!r.ok)return Response.json({ok:false,error:'Launch readiness save failed'},{status:502});return Response.json({ok:true,check:Array.isArray(r.body)?r.body[0]:r.body},{headers:{'Cache-Control':'private, no-store'}});
  }
  return new Response(null,{status:405});
}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}};}
export default createLaunchReadinessHandler();
export const config={path:'/api/internal/launch-readiness'};
