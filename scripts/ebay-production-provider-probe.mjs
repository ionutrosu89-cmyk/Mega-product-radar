import {ebayBuyAccessState,EBAY_BUY_AUTH} from '../netlify/functions/_ebay-buy-auth.mjs';
import {SAAS_CONFIG} from '../saas-config.js';

const env=process.env;
const clean=value=>String(value??'').trim();
const isProduction=String(env.CONTEXT||'').toLowerCase()==='production';
const enabled=ebayBuyAccessState(env)==='READY_TO_COLLECT';
const TOKEN_URL='https://api.ebay.com/identity/v1/oauth2/token';
const STANDARD_SCOPE='https://api.ebay.com/oauth/api_scope';
const MARKETING_SCOPE=EBAY_BUY_AUTH.scope;

if(!isProduction||!enabled){
  console.log(JSON.stringify({probe:'EBAY_PROVIDER',skipped:true,context:clean(env.CONTEXT)||'unknown',accessState:ebayBuyAccessState(env)}));
  process.exit(0);
}

const result={
  provider:'EBAY',environment:'production',observedAt:new Date().toISOString(),accessState:ebayBuyAccessState(env),
  oauthMarketingReady:false,oauthStandardReady:false,oauthStandardPlusMarketingReady:false,
  taxonomyReady:false,marketingBestSellingReady:false,taxonomyHttp:null,marketingHttp:null,
  sampleCategoryId:'31388',sampleProductCount:0,evidenceClass:'PROVIDER_CAPABILITY_PROBE_NOT_SALES',
  providerSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,oauthDiagnostics:{}
};

function safeOAuthError(body,status){
  const error=clean(body?.error).slice(0,80)||null;
  const errorDescription=clean(body?.error_description).replace(/[\r\n\t]+/g,' ').slice(0,240)||null;
  return {status,error,errorDescription};
}
function basicAuth(){return Buffer.from(`${clean(env.EBAY_CLIENT_ID)}:${clean(env.EBAY_CLIENT_SECRET)}`,'utf8').toString('base64');}
async function requestToken(scope,label){
  const body=new URLSearchParams({grant_type:'client_credentials',scope});
  const response=await fetch(TOKEN_URL,{method:'POST',headers:{authorization:`Basic ${basicAuth()}`,'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body,signal:AbortSignal.timeout(15000)});
  let payload={};try{payload=await response.json();}catch{}
  result.oauthDiagnostics[label]=response.ok?{status:response.status,error:null,errorDescription:null}:safeOAuthError(payload,response.status);
  const token=response.ok?clean(payload?.access_token):'';
  return token||null;
}

try{
  // Probe each scope contract independently. Only status/error metadata is persisted; tokens never leave process memory.
  const marketingToken=await requestToken(MARKETING_SCOPE,'marketingOnly');
  result.oauthMarketingReady=Boolean(marketingToken);
  const standardToken=await requestToken(STANDARD_SCOPE,'standardOnly');
  result.oauthStandardReady=Boolean(standardToken);
  const standardPlusMarketingToken=await requestToken(`${STANDARD_SCOPE} ${MARKETING_SCOPE}`,'standardPlusMarketing');
  result.oauthStandardPlusMarketingReady=Boolean(standardPlusMarketingToken);

  const taxonomyToken=standardToken;
  if(taxonomyToken){
    const treeUrl=new URL('https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id');
    treeUrl.searchParams.set('marketplace_id','EBAY_US');
    const treeResponse=await fetch(treeUrl,{headers:{authorization:`Bearer ${taxonomyToken}`,accept:'application/json'},signal:AbortSignal.timeout(15000)});
    result.taxonomyHttp=treeResponse.status;
    if(treeResponse.ok){const tree=await treeResponse.json().catch(()=>({}));result.taxonomyReady=/^\d+$/.test(clean(tree?.categoryTreeId));}
  }

  // Prefer the most specific working application token, but also test the standard token when eBay rejects the current marketing scope.
  const usableMarketingToken=standardPlusMarketingToken||marketingToken||standardToken;
  if(usableMarketingToken){
    const marketingUrl=new URL('https://api.ebay.com/buy/marketing/v1/merchandised_product');
    marketingUrl.searchParams.set('category_id',result.sampleCategoryId);
    marketingUrl.searchParams.set('metric_name','BEST_SELLING');
    marketingUrl.searchParams.set('limit','25');
    const marketingResponse=await fetch(marketingUrl,{headers:{authorization:`Bearer ${usableMarketingToken}`,'X-EBAY-C-MARKETPLACE-ID':'EBAY_US',accept:'application/json'},signal:AbortSignal.timeout(15000)});
    result.marketingHttp=marketingResponse.status;
    let body={};try{body=await marketingResponse.json();}catch{}
    if(marketingResponse.ok){result.sampleProductCount=Array.isArray(body?.merchandisedProducts)?body.merchandisedProducts.length:0;result.marketingBestSellingReady=result.sampleProductCount>0;}
    else result.marketingApiError={status:marketingResponse.status,errorId:clean(body?.errors?.[0]?.errorId).slice(0,40)||null,domain:clean(body?.errors?.[0]?.domain).slice(0,80)||null,category:clean(body?.errors?.[0]?.category).slice(0,80)||null,message:clean(body?.errors?.[0]?.message).slice(0,240)||null};
  }
}catch(error){result.errorCode=String(error?.message||error).slice(0,120);}

const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl),service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
if(supabaseUrl&&service){
  const row={bundle_ref:'EBAY_PROVIDER_PROBE_CURRENT',environment:'production',payload:result,provider_data_spend_eur:0,paid_data_calls_triggered:0,purchase_authorized:false,sales_evidence_class:'NOT_VERIFIED_SALES',observed_at:result.observedAt};
  const url=new URL(`${supabaseUrl}/rest/v1/production_evidence_runs`);url.searchParams.set('on_conflict','bundle_ref');
  const persisted=await fetch(url,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row]),signal:AbortSignal.timeout(15000)}).catch(()=>null);
  result.evidencePersisted=Boolean(persisted?.ok);
}else result.evidencePersisted=false;

console.log(JSON.stringify({probe:'EBAY_PROVIDER',accessState:result.accessState,oauthMarketingReady:result.oauthMarketingReady,oauthStandardReady:result.oauthStandardReady,oauthStandardPlusMarketingReady:result.oauthStandardPlusMarketingReady,taxonomyReady:result.taxonomyReady,marketingBestSellingReady:result.marketingBestSellingReady,taxonomyHttp:result.taxonomyHttp,marketingHttp:result.marketingHttp,sampleProductCount:result.sampleProductCount,evidencePersisted:result.evidencePersisted,oauthDiagnostics:result.oauthDiagnostics,marketingApiError:result.marketingApiError||null,errorCode:result.errorCode||null}));
process.exit(0);
