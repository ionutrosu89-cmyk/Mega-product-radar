const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0?Number(v):null;
const nonNegative=v=>finite(v)&&Number(v)>=0?Number(v):null;
const asinRe=/^[A-Z0-9]{10}$/;
const cleanAsin=v=>{const a=upper(v);return asinRe.test(a)?a:null;};

function walk(node,visit,context={}){
  if(Array.isArray(node)){for(const x of node)walk(x,visit,context);return;}
  if(!node||typeof node!=='object')return;
  const next={...context};
  if(clean(node.datetime))next.observedAt=clean(node.datetime);
  if(clean(node.check_url))next.checkUrl=clean(node.check_url);
  visit(node,next);
  for(const value of Object.values(node))if(value&&typeof value==='object')walk(value,visit,next);
}

export function extractDataForSeoAmazonPriceObservations(response={}){
  const byAsin=new Map();
  walk(response,(node,ctx)=>{
    const asin=cleanAsin(node.data_asin??node.asin);
    const type=clean(node.type).toLowerCase();
    if(!asin||!['amazon_serp','amazon_paid'].includes(type))return;
    const from=positive(node.price_from);
    const to=positive(node.price_to);
    const currency=upper(node.currency)||null;
    if(from===null&&to===null)return;
    const price=to!==null&&from!==null?Math.max(from,to):(to??from);
    const url=clean(node.url)||`https://www.amazon.com/dp/${asin}`;
    const observedAt=clean(ctx.observedAt)||null;
    if(!currency||!observedAt)return;
    const bought=nonNegative(node.bought_past_month);
    const ratingValue=finite(node.rating?.value)?Number(node.rating.value):null;
    const votes=nonNegative(node.rating?.votes_count);
    const candidate={
      marketplace:'AMAZON',
      externalProductId:asin,
      sourceUrl:url,
      observedAt,
      title:clean(node.title)||null,
      brand:clean(node.author)||null,
      price,
      priceFrom:from,
      priceTo:to,
      currency,
      rating:ratingValue,
      reviewCount:votes,
      evidenceClass:'PUBLIC_MARKETPLACE_LISTING_PROVIDER_OBSERVATION',
      sourceKey:'DATAFORSEO_MERCHANT_AMAZON_PRODUCTS_LIVE_ADVANCED',
      extractionMethod:'STRUCTURED_PROVIDER_AMAZON_SERP',
      provenance:{provider:'DATAFORSEO',providerCheckUrl:clean(ctx.checkUrl)||null,resultType:type,amazonDisplayedBoughtPastMonth:bought,boughtPastMonthEvidenceClass:bought===null?'UNKNOWN':'AMAZON_DISPLAYED_SIGNAL_NOT_VERIFIED_SALES'},
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      verifiedSales:false
    };
    const prior=byAsin.get(asin);
    if(!prior||candidate.price>prior.price)byAsin.set(asin,candidate);
  });
  return [...byAsin.values()].sort((a,b)=>a.externalProductId.localeCompare(b.externalProductId));
}

export const DataForSeoAmazonPriceTruthPolicy=Object.freeze({
  structuredProviderPriceIsRealizedSale:false,
  amazonDisplayedBoughtPastMonthIsVerifiedSales:false,
  asinIsCrossMarketCanonicalIdentity:false,
  unknownEqualsZero:false,
  purchaseAuthorized:false
});
