const present=v=>v!==null&&v!==undefined&&v!=='';
const finite=v=>present(v)&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const nonNegative=v=>finite(v)&&Number(v)>=0;
const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const iso=v=>{if(!clean(v))return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString();};

export function normalizeMarketplacePriceObservation(input={}){
  const blockers=[];
  const platform=upper(input.platform);
  const sourceUrl=clean(input.sourceUrl);
  const marketplaceListingId=clean(input.marketplaceListingId);
  const canonicalProductId=clean(input.canonicalProductId);
  const currency=upper(input.currency);
  const observedAt=iso(input.observedAt);
  const priceGross=positive(input.priceGross)?Number(input.priceGross):null;
  const shippingPrice=present(input.shippingPrice)&&nonNegative(input.shippingPrice)?Number(input.shippingPrice):input.shippingPrice===null||input.shippingPrice===undefined?null:null;
  if(!platform)blockers.push('PLATFORM_REQUIRED');
  if(!marketplaceListingId)blockers.push('LISTING_ID_REQUIRED');
  if(!canonicalProductId)blockers.push('CANONICAL_PRODUCT_ID_REQUIRED');
  if(!sourceUrl)blockers.push('SOURCE_URL_REQUIRED');
  if(!observedAt)blockers.push('OBSERVED_AT_REQUIRED');
  if(!currency)blockers.push('CURRENCY_REQUIRED');
  if(priceGross===null)blockers.push('POSITIVE_GROSS_PRICE_REQUIRED');
  if(present(input.shippingPrice)&&shippingPrice===null)blockers.push('INVALID_SHIPPING_PRICE');
  return {
    schemaVersion:'MPR_MARKETPLACE_PRICE_OBSERVATION_V1',
    valid:blockers.length===0,
    blockers,
    platform,
    canonicalProductId,
    marketplaceListingId,
    sourceUrl,
    seller:clean(input.seller)||null,
    brand:clean(input.brand)||null,
    currency,
    priceGross,
    shippingPrice,
    observedAt,
    availability:clean(input.availability)||null,
    evidenceClass:'PUBLIC_MARKETPLACE_LISTING',
    extractionMethod:clean(input.extractionMethod)||'UNKNOWN',
    confidence:finite(input.confidence)?Math.max(0,Math.min(100,Number(input.confidence))):null,
    truthPolicy:{marketplacePriceIsRealizedSale:false,verifiedSales:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

function normalizeTiers(tiers){
  if(!Array.isArray(tiers))return[];
  return tiers.map((t,index)=>({
    minQty:positive(t?.minQty)?Number(t.minQty):null,
    maxQty:positive(t?.maxQty)?Number(t.maxQty):null,
    unitPrice:positive(t?.unitPrice)?Number(t.unitPrice):null,
    index
  })).filter(t=>t.minQty!==null&&t.unitPrice!==null).sort((a,b)=>a.minQty-b.minQty);
}

export function chooseConservativePublicSupplierPrice(input={}){
  const targetQty=positive(input.targetOrderQuantity)?Number(input.targetOrderQuantity):null;
  const tiers=normalizeTiers(input.priceTiers);
  if(targetQty!==null&&tiers.length){
    const applicable=tiers.filter(t=>targetQty>=t.minQty&&(t.maxQty===null||targetQty<=t.maxQty));
    if(applicable.length){const tier=applicable.sort((a,b)=>b.unitPrice-a.unitPrice)[0];return{price:tier.unitPrice,rule:'EXACT_TARGET_QTY_TIER',confidence:'HIGH'};}
    const higher=tiers.filter(t=>t.minQty>targetQty).sort((a,b)=>a.minQty-b.minQty);
    if(higher.length)return{price:higher[0].unitPrice,rule:'CLOSEST_HIGHER_COST_TIER',confidence:'MEDIUM'};
  }
  const min=positive(input.publicPriceMin)?Number(input.publicPriceMin):null;
  const max=positive(input.publicPriceMax)?Number(input.publicPriceMax):null;
  if(max!==null)return{price:max,rule:min!==null&&min!==max?'AMBIGUOUS_RANGE_USE_MAX':'PUBLIC_PRICE_MAX',confidence:min!==null&&min!==max?'MEDIUM':'HIGH'};
  if(min!==null)return{price:min,rule:'ONLY_PUBLIC_PRICE_AVAILABLE',confidence:'LOW'};
  return{price:null,rule:'PRICE_UNKNOWN',confidence:'NONE'};
}

export function normalizeSupplierPriceObservation(input={}){
  const blockers=[];
  const platform=upper(input.platform);
  const supplierListingId=clean(input.supplierListingId);
  const sourceUrl=clean(input.sourceUrl);
  const currency=upper(input.currency);
  const observedAt=iso(input.observedAt);
  const min=positive(input.publicPriceMin)?Number(input.publicPriceMin):null;
  const max=positive(input.publicPriceMax)?Number(input.publicPriceMax):null;
  const moq=positive(input.moq)?Number(input.moq):null;
  const targetOrderQuantity=positive(input.targetOrderQuantity)?Number(input.targetOrderQuantity):null;
  const priceUnit=clean(input.priceUnit);
  const priceTiers=normalizeTiers(input.priceTiers);
  if(!['1688','ALIBABA','MADE-IN-CHINA','GLOBALSOURCES'].includes(platform))blockers.push('UNSUPPORTED_SUPPLIER_PLATFORM');
  if(!supplierListingId)blockers.push('SUPPLIER_LISTING_ID_REQUIRED');
  if(!sourceUrl)blockers.push('SOURCE_URL_REQUIRED');
  if(!currency)blockers.push('CURRENCY_REQUIRED');
  if(!observedAt)blockers.push('OBSERVED_AT_REQUIRED');
  if(min===null&&max===null&&priceTiers.length===0)blockers.push('PUBLIC_PRICE_REQUIRED');
  if(min!==null&&max!==null&&max<min)blockers.push('PRICE_RANGE_INVALID');
  if(!priceUnit)blockers.push('PRICE_UNIT_REQUIRED');
  const selected=chooseConservativePublicSupplierPrice({targetOrderQuantity,priceTiers,publicPriceMin:min,publicPriceMax:max});
  if(selected.price===null)blockers.push('NORMALIZED_PUBLIC_PRICE_UNRESOLVED');
  return {
    schemaVersion:'MPR_SUPPLIER_PRICE_OBSERVATION_V1',
    valid:blockers.length===0,
    blockers,
    platform,
    supplierListingId,
    supplierName:clean(input.supplierName)||null,
    sourceUrl,
    currency,
    publicPriceMin:min,
    publicPriceMax:max,
    priceTiers,
    moq,
    targetOrderQuantity,
    priceUnit,
    normalizedPublicUnitPrice:selected.price,
    supplierPriceRuleUsed:selected.rule,
    supplierPriceConfidence:selected.confidence,
    moqCompatible:moq===null||targetOrderQuantity===null?null:targetOrderQuantity>=moq,
    observedAt,
    evidenceClass:'PUBLIC_SUPPLIER_LISTING',
    verifiedQuote:false,
    negotiatedPriceIncluded:false,
    truthPolicy:{publicListingIsVerifiedQuote:false,supplierPriceIsLandedCost:false,minimumRangePriceUsedByDefault:false,negotiationIncludedInBaseCase:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}
