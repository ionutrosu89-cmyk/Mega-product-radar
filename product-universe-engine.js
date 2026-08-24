const text=v=>String(v??'').trim();
const num=v=>{
  if(v===null||v===undefined)return null;
  if(typeof v==='string'&&v.trim()==='')return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
};
const slug=v=>text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function canonicalProductKey(input={}){
  const source=text(input.source).toLowerCase();
  const externalId=text(input.externalId||input.asin||input.sku);
  if(source&&externalId)return `${source}:${externalId.toLowerCase()}`;
  const brand=slug(input.brand||'generic');
  const title=slug(input.title);
  if(!title)return null;
  return `fallback:${brand}:${title}`;
}

export function normalizeMarketplaceSnapshot(input={}){
  const observedAt=text(input.observedAt);
  const source=text(input.source).toLowerCase();
  const externalId=text(input.externalId||input.asin||input.sku);
  const title=text(input.title);
  const price=num(input.price);
  const rating=num(input.rating);
  const reviews=num(input.reviews);
  const rank=num(input.rank);
  const estimatedUnits=num(input.estimatedUnits);
  const estimatedRevenue=num(input.estimatedRevenue);
  const salesEvidenceClass=text(input.salesEvidenceClass||'UNKNOWN').toUpperCase();
  const validEvidenceClasses=['VERIFIED','ESTIMATED','DERIVED','UNKNOWN'];
  const errors=[];
  if(!source)errors.push('source required');
  if(!externalId)errors.push('externalId required');
  if(!title)errors.push('title required');
  if(!observedAt||Number.isNaN(Date.parse(observedAt)))errors.push('valid observedAt required');
  if(price!==null&&price<0)errors.push('price cannot be negative');
  if(rating!==null&&(rating<0||rating>5))errors.push('rating out of range');
  if(reviews!==null&&reviews<0)errors.push('reviews cannot be negative');
  if(rank!==null&&rank<=0)errors.push('rank must be positive');
  if(!validEvidenceClasses.includes(salesEvidenceClass))errors.push('invalid salesEvidenceClass');
  if(salesEvidenceClass==='VERIFIED'&&estimatedUnits!==null)errors.push('verified sales cannot be stored in estimatedUnits');

  return {
    valid:errors.length===0,
    errors,
    record:{
      productKey:canonicalProductKey({source,externalId,title,brand:input.brand}),
      source,externalId,title,
      brand:text(input.brand)||null,
      seller:text(input.seller)||null,
      marketplace:text(input.marketplace)||null,
      categoryKey:text(input.categoryKey)||null,
      url:text(input.url)||null,
      imageUrl:text(input.imageUrl)||null,
      observedAt:observedAt||null,
      price,currency:text(input.currency).toUpperCase()||null,
      rating,reviews,rank,
      estimatedUnits,estimatedRevenue,
      salesEvidenceClass,
      sourceConfidence:num(input.sourceConfidence),
      rawRef:text(input.rawRef)||null
    }
  };
}

export function dedupeMarketplaceSnapshots(records=[]){
  const latest=new Map();
  for(const raw of records){
    const normalized=normalizeMarketplaceSnapshot(raw);
    if(!normalized.valid)continue;
    const r=normalized.record;
    const key=`${r.source}:${r.externalId}:${r.observedAt}`;
    if(!latest.has(key))latest.set(key,r);
  }
  return [...latest.values()];
}

export function productUniverseBatchStats(records=[]){
  const normalized=records.map(normalizeMarketplaceSnapshot);
  const valid=normalized.filter(x=>x.valid).map(x=>x.record);
  const uniqueProducts=new Set(valid.map(x=>x.productKey));
  const sources=new Set(valid.map(x=>x.source));
  const categories=new Set(valid.map(x=>x.categoryKey).filter(Boolean));
  const withDirectUrl=valid.filter(x=>/^https:\/\//i.test(x.url||'')).length;
  const withObservedRank=valid.filter(x=>x.rank!==null).length;
  return {
    inputCount:records.length,
    validCount:valid.length,
    invalidCount:records.length-valid.length,
    uniqueProductCount:uniqueProducts.size,
    sourceCount:sources.size,
    categoryCount:categories.size,
    directUrlCoveragePct:valid.length?Number((withDirectUrl/valid.length*100).toFixed(1)):null,
    observedRankCoveragePct:valid.length?Number((withObservedRank/valid.length*100).toFixed(1)):null,
    commercialAction:null,
    purchaseAuthorized:false
  };
}
