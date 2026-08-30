import {SAAS_CONFIG} from '../../saas-config.js';

const REQUIRED_FIELDS=['LEGAL_OPERATOR_NAME','LEGAL_OPERATOR_VAT','LEGAL_OPERATOR_REGISTRY','LEGAL_OPERATOR_ADDRESS','LEGAL_SUPPORT_EMAIL'];
const REQUIRED_APPROVALS=['LEGAL_REFUND_POLICY_APPROVED','LEGAL_TERMS_REVIEWED_AT','LEGAL_PRIVACY_REVIEWED_AT'];

function validEmail(value=''){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());}
function truthy(value=''){return ['1','true','yes','approved'].includes(String(value).trim().toLowerCase());}
function validReviewDate(value=''){const date=new Date(String(value));return Number.isFinite(date.getTime())&&date.getTime()<=Date.now();}

export function assessLegalReadiness(env={}){
  const configured=Object.fromEntries(REQUIRED_FIELDS.map(key=>[key,Boolean(String(env[key]||'').trim())]));
  const approvals={
    LEGAL_REFUND_POLICY_APPROVED:truthy(env.LEGAL_REFUND_POLICY_APPROVED),
    LEGAL_TERMS_REVIEWED_AT:validReviewDate(env.LEGAL_TERMS_REVIEWED_AT),
    LEGAL_PRIVACY_REVIEWED_AT:validReviewDate(env.LEGAL_PRIVACY_REVIEWED_AT)
  };
  const supportEmailValid=validEmail(env.LEGAL_SUPPORT_EMAIL);
  const identityComplete=REQUIRED_FIELDS.every(key=>configured[key])&&supportEmailValid;
  const approvalsComplete=REQUIRED_APPROVALS.every(key=>approvals[key]);
  return {ready:identityComplete&&approvalsComplete,configured,approvals,checks:{identityComplete,approvalsComplete,supportEmailValid}};
}

async function jsonFetch(url,options,fetchImpl){const response=await fetchImpl(url,options);let body={};try{body=await response.json();}catch{}return {ok:response.ok,status:response.status,body};}

export function createLegalReadinessHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const auth=request.headers.get('authorization')||'';
      if(!/^Bearer\s+\S+/i.test(auth))return Response.json({ok:false,error:'Authentication required'},{status:401});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const userCheck=await jsonFetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anon,authorization:auth}},fetchImpl);
      if(!userCheck.ok)return Response.json({ok:false,error:'Invalid or expired session'},{status:401});
      const allowed=String(env.BETA_ANALYTICS_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if(!allowed.length)return Response.json({ok:false,error:'Admin allowlist is not configured'},{status:503});
      if(!allowed.includes(String(userCheck.body?.email||'').toLowerCase()))return Response.json({ok:false,error:'Admin access required'},{status:403});
      const result=assessLegalReadiness(env);
      return Response.json({ok:true,...result},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createLegalReadinessHandler();
export const config={path:'/api/internal/legal-readiness',method:'GET'};
