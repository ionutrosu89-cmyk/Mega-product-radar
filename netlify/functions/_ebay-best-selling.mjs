import {getEbayApplicationToken,ebayBuyAccessState} from './_ebay-buy-auth.mjs';

const API_URL='https://api.ebay.com/buy/marketing/v1/merchandised_product';
const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const finite=value=>Number.isFinite(Number(value));
const https=value=>{try{return new URL(clean(value)).protocol==='https:';}catch{return false;}};

export function parseEbayTargets(env=process.env){
  let raw;
  try{raw=JSON.parse(clean(env.MPR_EBAY_CROSS_MARKET_TARGETS_JSON)||'[]');}catch{return [];}
  if(!Array.isArray(raw))return [];
  const seen=new Set();
  return raw.flatMap(row=>{
    const nicheId=upper(row?.nicheId);
    const categoryId=clean(row?.categoryId);
    const marketplaceId=upper(row?.marketplaceId||'EBAY_US');
    if(!/^[A-Z0-9_]+$/.test(nicheId)||!/^[0-9]+$/.test(categoryId)||!/^EBAY_[A-Z]{2,5}$/.test(marketplaceId))return [];
    const key=`${nicheId}:${marketplaceId}`;
    if(seen.has(key))return [];
    seen.add(key);
    return [{nicheId,categoryId,marketplaceId}];
  }).slice(0,25);
}

function productUrl(epid,marketplaceId){
  const host=marketplaceId==='EBAY_DE'?'www.ebay.de':'www.ebay.com';
  return `https://${host}/p/${encodeURIComponent(epid)}`;
}

export function normalizeEbayBestSelling(payload,{target,observedAt=new Date().toISOString()}={}){
  const rows=Array.isArray(payload?.merchandisedProducts)?payload.merchandisedProducts:[];
  const normalized=rows.slice(0,25).map((row,index)=>{
    const epid=clean(row?.epid);
    const name=clean(row?.title).slice(0,220);
    if(!epid||!name)return null;
    const priceDetail=Array.isArray(row?.marketPriceDetails)?row.marketPriceDetails.find(item=>finite(item?.estimatedStartPrice?.value))||row.marketPriceDetails.find(item=>finite(item?.marketPrice?.value)):null;
    const amount=priceDetail?.estimatedStartPrice||priceDetail?.marketPrice||null;
    const sourceUrl=productUrl(epid,target.marketplaceId);
    if(!https(sourceUrl))return null;
    return {
      name,
      externalId:epid,
      rank:index+1,
      platform:'EBAY',
      sourceUrl,
      observedAt,
      conceptKey:null,
      sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',
      sourceLabel:'eBay Buy Marketing API',
      rankingBasis:'BEST_SELLING',
      market:target.marketplaceId,
      price:finite(amount?.value)?Number(amount.value):null,
      currency:upper(amount?.currency),
      rating:finite(row?.averageRating)?Number(row.averageRating):null,
      reviewCount:Number.isInteger(Number(row?.reviewCount))?Number(row.reviewCount):null,
      sourceMetric:{label:'eBay metric',value:'BEST_SELLING',unit:'platform_rank'},
      evidenceClass:'DIRECT',
      salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES',
      commercialGate:'BRAND_REVIEW_REQUIRED'
    };
  }).filter(Boolean);
  return normalized.length===25?normalized:[];
}

export async function collectEbayBestSellingTarget({target,env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
  if(ebayBuyAccessState(env)!=='READY_TO_COLLECT')return {ok:false,code:'EBAY_ACCESS_NOT_READY',target,products:[]};
  const token=await getEbayApplicationToken({env,fetchImpl,now:()=>now().getTime()});
  const url=new URL(API_URL);
  url.searchParams.set('category_id',target.categoryId);
  url.searchParams.set('metric_name','BEST_SELLING');
  url.searchParams.set('limit','25');
  const response=await fetchImpl(url,{headers:{authorization:`Bearer ${token}`,'X-EBAY-C-MARKETPLACE-ID':target.marketplaceId,accept:'application/json'}});
  if(!response.ok)return {ok:false,code:`EBAY_MARKETING_HTTP_${response.status}`,target,products:[]};
  const payload=await response.json();
  const products=normalizeEbayBestSelling(payload,{target,observedAt:now().toISOString()});
  if(products.length!==25)return {ok:false,code:'EBAY_TOP25_INCOMPLETE',target,products:[]};
  return {ok:true,code:'READY',target,products};
}

export const EBAY_BEST_SELLING={apiUrl:API_URL,metric:'BEST_SELLING',requiredCount:25};
