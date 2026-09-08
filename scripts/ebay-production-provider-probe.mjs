import {getEbayApplicationToken,ebayBuyAccessState,EBAY_BUY_AUTH} from '../netlify/functions/_ebay-buy-auth.mjs';
import {SAAS_CONFIG} from '../saas-config.js';

const env=process.env;
const clean=value=>String(value??'').trim();
const isProduction=String(env.CONTEXT||'').toLowerCase()==='production';
const enabled=ebayBuyAccessState(env)==='READY_TO_COLLECT';

if(!isProduction||!enabled){
  console.log(JSON.stringify({probe:'EBAY_PROVIDER',skipped:true,context:clean(env.CONTEXT)||'unknown',accessState:ebayBuyAccessState(env)}));
  process.exit(0);
}

const result={
  provider:'EBAY',
  environment:'production',
  observedAt:new Date().toISOString(),
  accessState:ebayBuyAccessState(env),
  oauthMarketingReady:false,
  taxonomyReady:false,
  marketingBestSellingReady:false,
  taxonomyHttp:null,
  marketingHttp:null,
  sampleCategoryId:'31388',
  sampleProductCount:0,
  evidenceClass:'PROVIDER_CAPABILITY_PROBE_NOT_SALES',
  providerSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false
};

try{
  const marketingToken=await getEbayApplicationToken({env,scope:EBAY_BUY_AUTH.scope});
  result.oauthMarketingReady=Boolean(marketingToken);

  const taxonomyToken=await getEbayApplicationToken({env,scope:EBAY_BUY_AUTH.taxonomyScope});
  const treeUrl=new URL('https://api.ebay.com/commerce/taxonomy/v1/get_default_category_tree_id');
  treeUrl.searchParams.set('marketplace_id','EBAY_US');
  const treeResponse=await fetch(treeUrl,{headers:{authorization:`Bearer ${taxonomyToken}`,accept:'application/json'},signal:AbortSignal.timeout(15000)});
  result.taxonomyHttp=treeResponse.status;
  if(treeResponse.ok){
    const tree=await treeResponse.json().catch(()=>({}));
    result.taxonomyReady=/^\d+$/.test(clean(tree?.categoryTreeId));
  }

  const marketingUrl=new URL('https://api.ebay.com/buy/marketing/v1/merchandised_product');
  marketingUrl.searchParams.set('category_id',result.sampleCategoryId);
  marketingUrl.searchParams.set('metric_name','BEST_SELLING');
  marketingUrl.searchParams.set('limit','25');
  const marketingResponse=await fetch(marketingUrl,{headers:{authorization:`Bearer ${marketingToken}`,'X-EBAY-C-MARKETPLACE-ID':'EBAY_US',accept:'application/json'},signal:AbortSignal.timeout(15000)});
  result.marketingHttp=marketingResponse.status;
  if(marketingResponse.ok){
    const body=await marketingResponse.json().catch(()=>({}));
    result.sampleProductCount=Array.isArray(body?.merchandisedProducts)?body.merchandisedProducts.length:0;
    result.marketingBestSellingReady=result.sampleProductCount>0;
  }
}catch(error){
  result.errorCode=String(error?.message||error).slice(0,120);
}

const supabaseUrl=clean(env.SUPABASE_URL||SAAS_CONFIG.supabaseUrl);
const service=clean(env.SUPABASE_SERVICE_ROLE_KEY);
if(supabaseUrl&&service){
  const row={
    bundle_ref:'EBAY_PROVIDER_PROBE_CURRENT',
    environment:'production',
    payload:result,
    provider_data_spend_eur:0,
    paid_data_calls_triggered:0,
    purchase_authorized:false,
    sales_evidence_class:'NOT_VERIFIED_SALES',
    observed_at:result.observedAt
  };
  const url=new URL(`${supabaseUrl}/rest/v1/production_evidence_runs`);
  url.searchParams.set('on_conflict','bundle_ref');
  const persisted=await fetch(url,{method:'POST',headers:{apikey:service,authorization:`Bearer ${service}`,'content-type':'application/json',prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row]),signal:AbortSignal.timeout(15000)}).catch(()=>null);
  result.evidencePersisted=Boolean(persisted?.ok);
}else result.evidencePersisted=false;

console.log(JSON.stringify({probe:'EBAY_PROVIDER',accessState:result.accessState,oauthMarketingReady:result.oauthMarketingReady,taxonomyReady:result.taxonomyReady,marketingBestSellingReady:result.marketingBestSellingReady,taxonomyHttp:result.taxonomyHttp,marketingHttp:result.marketingHttp,sampleProductCount:result.sampleProductCount,evidencePersisted:result.evidencePersisted,errorCode:result.errorCode||null}));
// Provider readiness is evidence, not a build dependency. A transient eBay outage must not break unrelated MPR deploys.
process.exit(0);
