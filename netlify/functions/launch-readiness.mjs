import {SAAS_CONFIG} from '../../saas-config.js';

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

export function serverBillingAcceptanceReady(row){
  const verdict=row?.verdict||{};
  return String(row?.status||'').toUpperCase()==='GO'&&Number(row?.checkpoint_count)===6&&verdict?.ok===true&&String(verdict?.verdict||'').toUpperCase()==='GO';
}

export function summarize(rows=[],options={}){
  const map=new Map(rows.map(r=>[r.check_code,r]));
  const enforceCurrentBilling=options.billingE2eCurrent!==undefined;
  const checks=REQUIRED_CHECKS.map(code=>{
    const row=map.get(code)||{};
    let status=STATUS.has(row.status)?row.status:'BLOCKED';
    let evidenceNote=row.evidence_note||null;
    let verifiedAt=row.verified_at||null;
    if(code==='BILLING_E2E'&&enforceCurrentBilling&&options.billingE2eCurrent!==true){status='BLOCKED';evidenceNote='Current deployment has no server-verified billing E2E GO';verifiedAt=null;}
    return {checkCode:code,status,evidenceNote,verifiedAt};
  });
  return {checks,passed:checks.filter(x=>x.status==='PASS').length,total:REQUIRED_CHECKS.length,allManualPassed:checks.every(x=>x.status==='PASS')};
}

export function launchPassEvidence(checkCode,body={}){
  if(checkCode!=='BILLING_E2E')return {ok:true,note:String(body.evidenceNote||'').trim().slice(0,2000)};
  const acceptance=body.serverBillingAcceptance;
  if(!serverBillingAcceptanceReady(acceptance))return {ok:false,error:'Current deployment requires server-owned sandbox billing E2E GO before BILLING_E2E can PASS'};
  return {ok:true,note:'MPR_SERVER_BILLING_E2E_GO; deployment-bound; six checkpoints; server-owned'.slice(0,2000)};
}

async function currentBillingAcceptance({base,headers,env,fetchImpl}){
  const workspaceId=String(env.MPR_SANDBOX_WORKSPACE_ID||'').trim();
  const deploymentRef=String(env.MPR_DEPLOYMENT_REF||env.COMMIT_REF||env.DEPLOY_ID||'').trim();
  if(!workspaceId||deploymentRef.length<7)return {ok:true,ready:false,row:null};
  const r=await jsonFetch(`${base}/rest/v1/billing_e2e_acceptance_runs?select=status,verdict,checkpoint_count,completed_at&environment=eq.SANDBOX&workspace_id=eq.${encodeURIComponent(workspaceId)}&deployment_ref=eq.${encodeURIComponent(deploymentRef)}&limit=1`,{headers},fetchImpl);
  if(!r.ok)return {ok:false,ready:false,row:null};
  const row=Array.isArray(r.body)?r.body[0]||null:null;
  return {ok:true,ready:serverBillingAcceptanceReady(row),row};
}

export function createLaunchReadinessHandler({fetch:fetchImpl=fetch,env=process.env}={}){return async request=>{try{
  const admin=await adminState(request,{fetchImpl,env});if(admin.error)return Response.json({ok:false,error:admin.error},{status:admin.status});const base=admin.supabaseUrl,h=admin.headers;
  if(request.method==='GET'){
    const [r,billingAcceptance]=await Promise.all([
      jsonFetch(`${base}/rest/v1/launch_readiness_checks?select=check_code,status,evidence_note,verified_at&limit=100`,{headers:h},fetchImpl),
      currentBillingAcceptance({base,headers:h,env,fetchImpl})
    ]);
    if(!r.ok)return Response.json({ok:false,error:'Launch readiness unavailable'},{status:502});
    if(!billingAcceptance.ok)return Response.json({ok:false,error:'Billing E2E acceptance state unavailable'},{status:502});
    return Response.json({ok:true,...summarize(Array.isArray(r.body)?r.body:[],{billingE2eCurrent:billingAcceptance.ready})},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
  }
  if(request.method==='POST'){
    const body=await request.json().catch(()=>({}));const checkCode=String(body.checkCode||'').toUpperCase(),status=String(body.status||'').toUpperCase();
    if(!REQUIRED_CHECKS.includes(checkCode))return Response.json({ok:false,error:'Unknown launch check'},{status:400});if(!STATUS.has(status))return Response.json({ok:false,error:'Invalid launch status'},{status:400});
    let evidence;
    if(status==='PASS'&&checkCode==='BILLING_E2E'){
      const billingAcceptance=await currentBillingAcceptance({base,headers:h,env,fetchImpl});
      if(!billingAcceptance.ok)return Response.json({ok:false,error:'Billing E2E acceptance state unavailable'},{status:502});
      evidence=launchPassEvidence(checkCode,{serverBillingAcceptance:billingAcceptance.row});
    }else evidence=status==='PASS'?launchPassEvidence(checkCode,body):{ok:true,note:String(body.evidenceNote||'').trim().slice(0,2000)};
    if(!evidence.ok)return Response.json({ok:false,error:evidence.error},{status:400});
    const note=String(evidence.note||'').trim().slice(0,2000);if(status==='PASS'&&note.length<8)return Response.json({ok:false,error:'Evidence note required before PASS'},{status:400});
    const now=new Date().toISOString(),row={check_code:checkCode,status,evidence_note:note||null,updated_at:now,verified_by:status==='PASS'?admin.user.id:null,verified_at:status==='PASS'?now:null};
    const r=await jsonFetch(`${base}/rest/v1/launch_readiness_checks?on_conflict=check_code`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)},fetchImpl);if(!r.ok)return Response.json({ok:false,error:'Launch readiness save failed'},{status:502});return Response.json({ok:true,check:Array.isArray(r.body)?r.body[0]:r.body},{headers:{'Cache-Control':'private, no-store'}});
  }
  return new Response(null,{status:405});
}catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500});}};}
export default createLaunchReadinessHandler();
export const config={path:'/api/internal/launch-readiness'};
