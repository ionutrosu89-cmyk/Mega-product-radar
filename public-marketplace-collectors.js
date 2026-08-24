import {normalizeRankingObservation} from './public-rankings-acquisition.js';

const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'));return Number.isFinite(x)?x:null;};
const positiveInt=v=>{const x=num(v);return Number.isInteger(x)&&x>0?x:null;};
const https=v=>/^https:\/\//i.test(text(v))?text(v):null;

export const PUBLIC_COLLECTOR_POLICY=Object.freeze({
  AMAZON:{execution:'REVIEWED_SERVER_FETCH_ONLY',robotsAndTermsReviewRequired:true,rateLimitRequired:true,cacheRequired:true,paid:false},
  ALIBABA:{execution:'REVIEWED_SERVER_FETCH_ONLY',robotsAndTermsReviewRequired:true,rateLimitRequired:true,cacheRequired:true,paid:false},
  EBAY:{execution:'OFFICIAL_API_SERVER_ONLY',credentialsRequired:true,rateLimitRequired:true,cacheRequired:true,paid:false}
});

export function amazonSurfaceUrl({market='US',surface='BEST_SELLERS',categoryPath=''}={}){
  const hosts={US:'www.amazon.com',DE:'www.amazon.de',FR:'www.amazon.fr',IT:'www.amazon.it',ES:'www.amazon.es',UK:'www.amazon.co.uk'};
  const host=hosts[text(market).toUpperCase()];
  if(!host)return null;
  const base={BEST_SELLERS:'/gp/bestsellers',NEW_RELEASES:'/gp/new-releases',MOVERS_AND_SHAKERS:'/gp/movers-and-shakers'}[text(surface).toUpperCase()];
  if(!base)return null;
  const suffix=text(categoryPath).replace(/^\/+|\/+$/g,'');
  return `https://${host}${base}${suffix?'/'+suffix:''}`;
}

export function normalizeAmazonRows(rows=[],meta={}){
  const sourceKey={BEST_SELLERS:'AMAZON_BEST_SELLERS',NEW_RELEASES:'AMAZON_NEW_RELEASES',MOVERS_AND_SHAKERS:'AMAZON_MOVERS_SHAKERS'}[text(meta.surface||'BEST_SELLERS').toUpperCase()];
  if(!sourceKey)return{records:[],rejected:[{error:'AMAZON_SURFACE_INVALID'}]};
  const records=[],rejected=[];
  for(const row of rows||[]){
    const out=normalizeRankingObservation({sourceKey,externalId:text(row.asin)||null,url:https(row.url),title:row.title,brand:row.brand,categoryLabel:meta.categoryLabel,sourceCategoryId:meta.sourceCategoryId,sourceRank:positiveInt(row.rank),price:num(row.price),currency:row.currency,rating:num(row.rating),reviewCount:num(row.reviewCount),imageUrl:https(row.imageUrl),observedAt:meta.observedAt});
    if(out.ok)records.push({...out.record,market:text(meta.market).toUpperCase()||null});else rejected.push({row,error:out.error});
  }
  return{records,rejected,sourceKey,networkExecuted:false,paidCallsTriggered:0};
}

export function alibabaTopRankingUrl({categorySlug=''}={}){
  const slug=text(categorySlug).replace(/^\/+|\/+$/g,'');
  return slug?`https://www.alibaba.com/showroom/${encodeURIComponent(slug)}.html`:'https://www.alibaba.com/';
}

export function normalizeAlibabaRows(rows=[],meta={}){
  const records=[],rejected=[];
  for(const row of rows||[]){
    const out=normalizeRankingObservation({sourceKey:'ALIBABA_TOP_RANKING',externalId:text(row.productId)||null,url:https(row.url),title:row.title,brand:row.brand,seller:row.supplier,categoryLabel:meta.categoryLabel,sourceCategoryId:meta.sourceCategoryId,sourceRank:positiveInt(row.rank),price:num(row.price),currency:row.currency,rating:num(row.rating),reviewCount:num(row.reviewCount),imageUrl:https(row.imageUrl),observedAt:meta.observedAt});
    if(out.ok)records.push(out.record);else rejected.push({row,error:out.error});
  }
  return{records,rejected,sourceKey:'ALIBABA_TOP_RANKING',networkExecuted:false,paidCallsTriggered:0};
}

export function ebayBestSellingRequest({categoryId,marketplaceId='EBAY_US',limit=100}={}){
  const category=text(categoryId);if(!category)return{ok:false,error:'EBAY_CATEGORY_REQUIRED'};
  const safeLimit=Math.max(1,Math.min(100,positiveInt(limit)||100));
  return{ok:true,method:'GET',path:'/buy/marketing/v1_beta/merchandised_product',query:{category_id:category,metric_name:'BEST_SELLING',limit:safeLimit},headers:{'X-EBAY-C-MARKETPLACE-ID':text(marketplaceId)||'EBAY_US',authorization:'Bearer ${EBAY_OAUTH_TOKEN}'},serverSecretRequired:'EBAY_OAUTH_TOKEN',executeAutomatically:false};
}

export function normalizeEbayBestSelling(payload={},meta={}){
  const items=Array.isArray(payload?.merchandisedProducts)?payload.merchandisedProducts:Array.isArray(payload?.itemSummaries)?payload.itemSummaries:[];
  const records=[],rejected=[];
  items.forEach((row,index)=>{
    const price=row?.price?.value??row?.minPrice?.value??null;
    const currency=row?.price?.currency??row?.minPrice?.currency??null;
    const image=row?.image?.imageUrl??row?.thumbnailImages?.[0]?.imageUrl??null;
    const out=normalizeRankingObservation({sourceKey:'EBAY_BEST_SELLING',externalId:row.epid||row.itemId||row.productId||null,url:https(row.itemWebUrl||row.webUrl),title:row.title||row.productTitle,brand:row.brand,categoryLabel:meta.categoryLabel,sourceCategoryId:meta.sourceCategoryId,sourceRank:index+1,price:num(price),currency,rating:num(row.rating),reviewCount:num(row.reviewCount),imageUrl:https(image),observedAt:meta.observedAt});
    if(out.ok)records.push({...out.record,market:text(meta.marketplaceId)||null});else rejected.push({row,error:out.error});
  });
  return{records,rejected,sourceKey:'EBAY_BEST_SELLING',networkExecuted:false,paidCallsTriggered:0};
}

export function collectorHealth(result={}){
  const accepted=Array.isArray(result.records)?result.records.length:0,rejected=Array.isArray(result.rejected)?result.rejected.length:0,total=accepted+rejected;
  return{accepted,rejected,total,acceptancePct:total?Number((accepted/total*100).toFixed(1)):0,healthy:accepted>0&&rejected/Math.max(1,total)<=0.25,networkExecuted:false,purchaseAuthorized:false};
}
