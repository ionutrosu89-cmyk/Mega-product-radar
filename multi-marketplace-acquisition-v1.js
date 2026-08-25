import {MARKETPLACE_SOURCE_EXPANSION} from './marketplace-source-expansion.js';

const has=(env,key)=>Boolean(String(env?.[key]??'').trim());
const source=key=>MARKETPLACE_SOURCE_EXPANSION[key];

function credentialState(src,env={}){
  const required=Array.isArray(src.credentialEnv)?src.credentialEnv:[];
  const missing=required.filter(k=>!has(env,k));
  return {required,missing,ready:src.credentialsRequired!==true||missing.length===0};
}

function baseResult(sourceKey,env={}){
  const src=source(sourceKey);
  if(!src)return {ok:false,error:'UNKNOWN_SOURCE',sourceKey};
  const credentials=credentialState(src,env);
  if(src.credentialsRequired===true&&!credentials.ready){
    return {ok:false,error:'CREDENTIALS_REQUIRED',sourceKey,platform:src.platform,missingCredentialEnv:credentials.missing,executeAutomatically:false,paidCallsTriggered:0,approvedSpendEur:0,purchaseAuthorized:false};
  }
  return {ok:true,sourceKey,platform:src.platform,signalRole:src.signalRole,marketWideEvidence:src.marketWideEvidence,sellerScoped:src.sellerScoped,storeScoped:src.storeScoped,executeAutomatically:false,paidCallsTriggered:0,approvedSpendEur:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'};
}

export function buildEbayBestSellingDescriptor({categoryId,marketplaceId='EBAY_US',limit=100,env={}}={}){
  const out=baseResult('EBAY_BEST_SELLING',env); if(!out.ok)return out;
  const id=String(categoryId??'').trim();
  if(!/^\d+$/.test(id))return {...out,ok:false,error:'CATEGORY_ID_REQUIRED'};
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||100));
  return {...out,method:'GET',path:'/buy/marketing/v1_beta/merchandised_product',headers:{'X-EBAY-C-MARKETPLACE-ID':marketplaceId,authorizationSecretEnv:'EBAY_OAUTH_TOKEN'},query:{category_id:id,metric_name:'BEST_SELLING',limit:safeLimit},rankingEvidence:true};
}

export function buildEmagSellerDescriptor({resource='products',env={}}={}){
  const out=baseResult('EMAG_MARKETPLACE_SELLER_API',env); if(!out.ok)return out;
  return {...out,access:'OFFICIAL_API',resource:String(resource||'products'),scope:'AUTHORIZED_SELLER_ACCOUNT_ONLY',marketWideEvidence:false,rankingEvidence:false,warning:'SELLER_ACCOUNT_DATA_IS_NOT_WHOLE_EMAG_MARKET'};
}

export function buildEmagPublicReviewDescriptor({url}={}){
  const out=baseResult('EMAG_PUBLIC_MARKET',{});
  const u=String(url??'').trim();
  if(!/^https:\/\/(www\.)?emag\.ro\//i.test(u))return {...out,ok:false,error:'REVIEWED_EMAG_URL_REQUIRED'};
  return {...out,url:u,access:'REVIEWED_PUBLIC_PAGE',requiresManualReview:true,rankingEvidence:false,salesEvidenceClass:'NOT_VERIFIED_SALES'};
}

export function buildAliExpressDescriptor({query,env={}}={}){
  const out=baseResult('ALIEXPRESS_OFFICIAL_API',env); if(!out.ok)return out;
  const q=String(query??'').trim(); if(!q)return {...out,ok:false,error:'QUERY_REQUIRED'};
  return {...out,access:'OFFICIAL_API',operation:'PRODUCT_SEARCH',query:q,rankingEvidence:false,volumeEvidenceClass:'PLATFORM_STATED_SIGNAL_NOT_VERIFIED_SALES'};
}

export function buildAlibabaSupplyDescriptor({categorySlug}={}){
  const out=baseResult('ALIBABA_TOP_RANKING',{});
  const slug=String(categorySlug??'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
  if(!slug)return {...out,ok:false,error:'CATEGORY_SLUG_REQUIRED'};
  return {...out,url:`https://www.alibaba.com/showroom/${slug}.html`,access:'PUBLIC_PAGE',rankingEvidence:false,demandEvidence:false,supplyEvidence:true,salesEvidenceClass:'NOT_VERIFIED_SALES'};
}

export function buildShopifyStorefrontDescriptor({shopDomain,query='',env={}}={}){
  const out=baseResult('SHOPIFY_STOREFRONT',env); if(!out.ok)return out;
  const shop=String(shopDomain??'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(shop))return {...out,ok:false,error:'SHOP_DOMAIN_REQUIRED'};
  return {...out,access:'OFFICIAL_API',shopDomain:shop,operation:'STORE_PRODUCTS',query:String(query??'').trim(),scope:'ONE_EXPLICIT_SHOP_ONLY',marketWideEvidence:false,rankingEvidence:false,warning:'SHOPIFY_IS_NOT_A_SINGLE_MARKETPLACE'};
}

export function multiMarketplaceReadiness({env={},shopDomain=null}={}){
  const builders={
    EBAY:buildEbayBestSellingDescriptor({categoryId:'1',env}),
    EMAG:buildEmagSellerDescriptor({env}),
    ALIEXPRESS:buildAliExpressDescriptor({query:'probe',env}),
    ALIBABA:buildAlibabaSupplyDescriptor({categorySlug:'probe'}),
    SHOPIFY:buildShopifyStorefrontDescriptor({shopDomain:shopDomain||'example.myshopify.com',env})
  };
  return {
    sources:builders,
    ready:Object.entries(builders).filter(([,x])=>x.ok).map(([k])=>k),
    blocked:Object.entries(builders).filter(([,x])=>!x.ok).map(([k,x])=>({platform:k,error:x.error,missingCredentialEnv:x.missingCredentialEnv??[]})),
    executeAutomatically:false,paidCallsTriggered:0,approvedSpendEur:0,purchaseAuthorized:false
  };
}
