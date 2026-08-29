const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const present=v=>v!==null&&v!==undefined&&v!=='';
const positive=v=>present(v)&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const nonNegative=v=>present(v)&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;

function parseRange(value){
  if(Array.isArray(value)&&value.length){const nums=value.map(positive).filter(Boolean);return nums.length?{min:Math.min(...nums),max:Math.max(...nums)}:{min:null,max:null};}
  if(typeof value==='number')return value>0?{min:value,max:value}:{min:null,max:null};
  const s=clean(value).replace(/,/g,'');
  if(!s)return{min:null,max:null};
  const nums=(s.match(/\d+(?:\.\d+)?/g)||[]).map(Number).filter(x=>x>0);
  return nums.length?{min:Math.min(...nums),max:Math.max(...nums)}:{min:null,max:null};
}
function detectCurrency(row){
  const explicit=upper(row.currency??row.priceCurrency??row.currencyCode);
  if(explicit)return explicit;
  const text=clean(row.price??row.priceRange??row.priceText);
  if(/\bUSD\b|US\s*\$/i.test(text)||text.includes('$'))return 'USD';
  if(/\bCNY\b|RMB|¥|￥/i.test(text))return 'CNY';
  if(/\bEUR\b|€/i.test(text))return 'EUR';
  return null;
}
function normalizeTiers(raw=[]){
  const rows=Array.isArray(raw)?raw:[];
  return rows.map(x=>{
    const minQuantity=positive(x.minQuantity??x.minQty??x.quantityFrom??x.from);
    const price=positive(x.price??x.unitPrice??x.value);
    const maxQuantity=positive(x.maxQuantity??x.maxQty??x.quantityTo??x.to);
    return minQuantity&&price?{minQuantity,maxQuantity,price}:null;
  }).filter(Boolean).sort((a,b)=>a.minQuantity-b.minQuantity);
}

export function adaptStructuredSupplierProviderRow(row={},options={}){
  const platform=upper(options.platform??row.platform??'ALIBABA');
  const supplierListingId=clean(row.productId??row.id??row.itemId??row.supplierListingId)||null;
  const sourceUrl=clean(row.productUrl??row.url??row.sourceUrl)||null;
  const title=clean(row.title??row.name??row.productTitle)||null;
  const range=parseRange(row.priceRange??row.price??row.priceText??[row.priceMin,row.priceMax]);
  const priceTiers=normalizeTiers(row.quantityPrices??row.priceTiers??row.tierPrices??row.pricingTiers);
  const tierPrices=priceTiers.map(x=>x.price);
  const publicPriceMin=range.min??(tierPrices.length?Math.min(...tierPrices):null);
  const publicPriceMax=range.max??(tierPrices.length?Math.max(...tierPrices):null);
  const currency=detectCurrency(row);
  const moq=positive(row.moq??row.minOrderQuantity??row.minimumOrderQuantity??priceTiers[0]?.minQuantity);
  const priceUnit=clean(row.priceUnit??row.unit??row.orderUnit??row.unitLabel)||'piece';
  const observedAt=clean(options.observedAt??row.observedAt)||new Date().toISOString();
  const blockers=[];
  if(!supplierListingId)blockers.push('SUPPLIER_LISTING_ID_REQUIRED');
  if(!sourceUrl)blockers.push('SOURCE_URL_REQUIRED');
  if(!currency)blockers.push('CURRENCY_REQUIRED');
  if(!publicPriceMin&&!publicPriceMax&&!priceTiers.length)blockers.push('PUBLIC_PRICE_REQUIRED');
  if(!priceUnit)blockers.push('PRICE_UNIT_REQUIRED');
  return {
    valid:blockers.length===0,blockers,
    schemaVersion:'MPR_STRUCTURED_SUPPLIER_PROVIDER_ROW_V1',
    normalizedObservation:{
      platform,supplierListingId,supplierName:clean(row.supplierName??row.companyName??row.supplier?.name)||null,
      sourceUrl,title,currency,publicPriceMin,publicPriceMax,priceTiers,moq,targetOrderQuantity:null,priceUnit,observedAt,
      linkedMarketplaceCanonicalProductId:null,supplierFingerprintId:null,
      variantAttributes:row.variantAttributes&&typeof row.variantAttributes==='object'?row.variantAttributes:{},
      structuredMetadata:{material:clean(row.material)||null,dimensions:row.dimensions??null,weight:row.weight??null,capacity:row.capacity??null,power:row.power??null,voltage:row.voltage??null,packCount:nonNegative(row.packCount)},
      provider:clean(options.provider??row.provider)||'STRUCTURED_PROVIDER',
      evidenceClass:'PUBLIC_SUPPLIER_LISTING'
    },
    truthPolicy:{providerRowIsVerifiedQuote:false,publicSupplierPriceIsLandedCost:false,providerResultIsMarketplaceMatch:false,negotiatedPriceIncluded:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

export function adaptStructuredSupplierProviderRows(rows=[],options={}){
  const adapted=(Array.isArray(rows)?rows:[]).map(row=>adaptStructuredSupplierProviderRow(row,options));
  return {
    schemaVersion:'MPR_SUPPLIER_PRICE_LEDGER_INPUT_V1',
    generatedAt:new Date().toISOString(),
    observations:adapted.filter(x=>x.valid).map(x=>x.normalizedObservation),
    rejected:adapted.filter(x=>!x.valid),
    truthPolicy:{providerResultIsVerifiedQuote:false,providerResultIsLandedCost:false,providerResultIsMarketplaceMatch:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}
