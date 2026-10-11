import {SAAS_CONFIG} from '../../saas-config.js';
import {authorizeReadinessRequest} from './_readiness-auth.mjs';
import {paidBillingEnabled} from './_commercial-launch-mode.mjs';

const REQUIRED=['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_DISCOVER','STRIPE_PRICE_RADAR','STRIPE_PRICE_LAUNCH','SUPABASE_SERVICE_ROLE_KEY'];
const PRICE_KEYS=['STRIPE_PRICE_DISCOVER','STRIPE_PRICE_RADAR','STRIPE_PRICE_LAUNCH'];

async function jsonFetch(url,options,fetchImpl){
  const r=await fetchImpl(url,options);
  let body={};
  try{body=await r.json();}catch{}
  return {ok:r.ok,status:r.status,body};
}

function stripeMode(secret=''){
  const value=String(secret||'');
  if(value.startsWith('sk_live_'))return 'LIVE';
  if(value.startsWith('sk_test_'))return 'SANDBOX';
  return value?'UNKNOWN':'UNCONFIGURED';
}

export function createBillingReadinessHandler({fetch:fetchImpl=fetch,env=process.env}={}){
  return async request=>{
    try{
      const supabaseUrl=env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl;
      const anon=env.SUPABASE_ANON_KEY||SAAS_CONFIG.supabaseAnonKey;
      const authorization=await authorizeReadinessRequest({request,env,fetchImpl,supabaseUrl,anonKey:anon});
      if(!authorization.ok)return authorization.response;

      const configured=Object.fromEntries(REQUIRED.map(k=>[k,Boolean(env[k])]));
      const prices={};
      const stripeSecret=env.STRIPE_SECRET_KEY;
      if(stripeSecret){
        for(const key of PRICE_KEYS){
          const id=env[key];
          if(!id){prices[key]={configured:false,valid:false};continue;}
          const r=await jsonFetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`,{headers:{authorization:`Bearer ${stripeSecret}`}},fetchImpl);
          prices[key]={configured:true,valid:r.ok,active:Boolean(r.body?.active),currency:r.body?.currency||null,unitAmount:r.body?.unit_amount??null,recurringInterval:r.body?.recurring?.interval||null};
        }
      }else{
        for(const key of PRICE_KEYS)prices[key]={configured:Boolean(env[key]),valid:false};
      }
      const allConfigured=REQUIRED.every(k=>configured[k]);
      const allPricesValid=PRICE_KEYS.every(k=>prices[k]?.valid&&prices[k]?.active&&prices[k]?.recurringInterval==='month');
      const expected={STRIPE_PRICE_DISCOVER:1790,STRIPE_PRICE_RADAR:2900,STRIPE_PRICE_LAUNCH:8900};
      const amountsMatch=PRICE_KEYS.every(k=>prices[k]?.unitAmount===expected[k]&&String(prices[k]?.currency||'').toLowerCase()==='eur');
      const mode=stripeMode(stripeSecret);
      const ready=allConfigured&&allPricesValid&&amountsMatch;
      const paidEnabled=paidBillingEnabled(env);
      return Response.json({
        ok:true,
        ready,
        stripeMode:mode,
        freeBetaOnly:!paidEnabled,
        paidBillingEnabled:paidEnabled,
        publicLaunchBillingReady:paidEnabled&&ready&&mode==='LIVE',
        configured,
        prices,
        checks:{allConfigured,allPricesValid,amountsMatch,webhookSecretPresent:Boolean(env.STRIPE_WEBHOOK_SECRET),serviceRolePresent:Boolean(env.SUPABASE_SERVICE_ROLE_KEY),liveMode:mode==='LIVE',paidBillingEnabled:paidEnabled}
      },{headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
    }catch(error){return Response.json({ok:false,error:String(error?.message||error)},{status:500,headers:{'Cache-Control':'no-store'}});}
  };
}

export {stripeMode};
export default createBillingReadinessHandler();
export const config={path:'/api/internal/billing-readiness',method:'GET'};
