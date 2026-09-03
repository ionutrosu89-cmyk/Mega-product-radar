import {SAAS_CONFIG} from '../../saas-config.js';
import {enforceRateLimit} from './_security-ops.mjs';

const ALLOWED_EVENTS=new Set([
  'FREE_LANDING_VIEW','FREE_TOP25_CTA_CLICK','FREE_TOP25_VIEW','FREE_NICHE_SELECTED','FREE_PRODUCT_OPENED',
  'FREE_SOURCE_OPENED','FREE_DECISION_REACHED','FREE_SIGNUP_CTA_CLICK','FREE_PRICING_CTA_CLICK'
]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text=(value,max)=>String(value??'').trim().slice(0,max)||null;

function safeMetadata(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const output={};
  for(const key of ['productName','decision','nicheLabel','offer','target','label']){
    const cleaned=text(source[key],key==='productName'?180:120);
    if(cleaned)output[key]=cleaned;
  }
  for(const key of ['nicheCount','productCount']){
    const number=Number(source[key]);
    if(Number.isFinite(number)&&number>=0&&number<=100000)output[key]=number;
  }
  return output;
}

function sameOrigin(request){
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
}

export function normalizeFreeDemandEvent(body){
  const eventName=text(body?.eventName,80);
  const page=text(body?.page,80);
  const pageSessionId=text(body?.pageSessionId,36);
  if(!ALLOWED_EVENTS.has(eventName)||!page||!UUID_RE.test(pageSessionId||''))return null;
  return {
    event_name:eventName,
    page,
    page_session_id:pageSessionId,
    niche_id:text(body?.nicheId,80),
    acquisition_source:text(body?.acquisitionSource,80),
    acquisition_medium:text(body?.acquisitionMedium,80),
    acquisition_campaign:text(body?.acquisitionCampaign,120),
    referrer_host:text(body?.referrerHost,160),
    metadata:safeMetadata(body?.metadata)
  };
}

export function createFreeDemandEventHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      if(!sameOrigin(request))return Response.json({ok:false,error:'Origin not allowed'},{status:403});
      if(Number(request.headers.get('content-length')||0)>8192)return Response.json({ok:false,error:'Payload too large'},{status:413});
      const row=normalizeFreeDemandEvent(await request.json());
      if(!row)return Response.json({ok:false,error:'Invalid event'},{status:400});
      const rate=await enforceRateLimit(request,{route:'free-demand',limit:40,windowSeconds:60,env,fetchImpl});
      if(!rate.ok)return Response.json({ok:false,error:'Too many requests'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds),'Cache-Control':'no-store'}});
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const service=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!supabaseUrl||!service)return Response.json({ok:false,error:'Telemetry unavailable'},{status:503});
      const response=await fetchImpl(`${supabaseUrl}/rest/v1/free_demand_events`,{
        method:'POST',
        headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'return=minimal'},
        body:JSON.stringify(row)
      });
      if(!response.ok)return Response.json({ok:false,error:'Telemetry unavailable'},{status:503});
      return Response.json({ok:true},{status:202,headers:{'Cache-Control':'no-store'}});
    }catch{return Response.json({ok:false,error:'Invalid event'},{status:400,headers:{'Cache-Control':'no-store'}});}
  };
}

export default createFreeDemandEventHandler();
export const config={path:'/api/free/demand-event',method:'POST'};
