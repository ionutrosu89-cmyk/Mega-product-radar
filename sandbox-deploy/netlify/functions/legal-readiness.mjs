import {SAAS_CONFIG} from '../../saas-config.js';
import {LEGAL_OPERATOR_CONFIG} from '../../legal-operator-config.js';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';

const REQUIRED_FIELDS=['LEGAL_OPERATOR_NAME','LEGAL_OPERATOR_VAT','LEGAL_OPERATOR_REGISTRY','LEGAL_OPERATOR_ADDRESS','LEGAL_SUPPORT_EMAIL'];
const REQUIRED_APPROVALS=['LEGAL_REFUND_POLICY_APPROVED','LEGAL_TERMS_REVIEWED_AT','LEGAL_PRIVACY_REVIEWED_AT'];
const PUBLIC_OPERATOR_DEFAULTS=Object.freeze({
  LEGAL_OPERATOR_NAME:LEGAL_OPERATOR_CONFIG.name,
  LEGAL_OPERATOR_VAT:LEGAL_OPERATOR_CONFIG.vat,
  LEGAL_OPERATOR_REGISTRY:LEGAL_OPERATOR_CONFIG.registry,
  LEGAL_OPERATOR_ADDRESS:LEGAL_OPERATOR_CONFIG.address,
  LEGAL_SUPPORT_EMAIL:LEGAL_OPERATOR_CONFIG.supportEmail
});

function validEmail(value=''){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());}
function truthy(value=''){return ['1','true','yes','approved'].includes(String(value).trim().toLowerCase());}
function validReviewDate(value=''){const date=new Date(String(value));return Number.isFinite(date.getTime())&&date.getTime()<=Date.now();}
function operatorValue(env,key){return String(env[key]||PUBLIC_OPERATOR_DEFAULTS[key]||'').trim();}

export function assessLegalReadiness(env={}){
  const values=Object.fromEntries(REQUIRED_FIELDS.map(key=>[key,operatorValue(env,key)]));
  const configured=Object.fromEntries(REQUIRED_FIELDS.map(key=>[key,Boolean(values[key])]));
  const approvals={
    LEGAL_REFUND_POLICY_APPROVED:truthy(env.LEGAL_REFUND_POLICY_APPROVED),
    LEGAL_TERMS_REVIEWED_AT:validReviewDate(env.LEGAL_TERMS_REVIEWED_AT),
    LEGAL_PRIVACY_REVIEWED_AT:validReviewDate(env.LEGAL_PRIVACY_REVIEWED_AT)
  };
  const supportEmailValid=validEmail(values.LEGAL_SUPPORT_EMAIL);
  const identityComplete=REQUIRED_FIELDS.every(key=>configured[key])&&supportEmailValid;
  const approvalsComplete=REQUIRED_APPROVALS.every(key=>approvals[key]);
  return {ready:identityComplete&&approvalsComplete,configured,approvals,checks:{identityComplete,approvalsComplete,supportEmailValid}};
}

export function createLegalReadinessHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const authorization=await authorizeReadinessRequest({request,env,fetchImpl,supabaseUrl,anonKey:anon});
      if(!authorization.ok)return authorization.response;
      const result=assessLegalReadiness(env);
      return Response.json({ok:true,...result},{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createLegalReadinessHandler();
export const config={path:'/api/internal/legal-readiness',method:'GET'};
