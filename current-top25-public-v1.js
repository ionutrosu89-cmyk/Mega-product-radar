const APPROVED_RIGHTS=new Set(['APPROVED_OFFICIAL_API','APPROVED_LICENSED_DATASET','APPROVED_PUBLIC_REDISTRIBUTION']);
const EVIDENCE=new Set(['DIRECT','DERIVED','ESTIMATED','INSUFFICIENT_DATA']);
const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

function validDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?null:date;}

function sanitizeProduct(product,index,{windowDays,windowEnd}={}){
  const row=product&&typeof product==='object'?product:{};
  const name=clean(row.name||row.title);
  const externalId=upper(row.externalId||row.asin||row.productId||row.epid);
  const sourceUrl=clean(row.sourceUrl);
  const observedAt=validDate(row.observedAt);
  if(!name||!externalId||!/^https:\/\//i.test(sourceUrl)||!observedAt)return null;
  const end=validDate(windowEnd);
  if(!end)return null;
  const ageMs=end.getTime()-observedAt.getTime();
  if(ageMs<0||ageMs>Number(windowDays)*86400000)return null;
  const evidenceClass=upper(row.evidenceClass||'DERIVED');
  if(!EVIDENCE.has(evidenceClass)||evidenceClass==='INSUFFICIENT_DATA')return null;
  return {...row,name,externalId,rank:index+1,observedAt:observedAt.toISOString(),evidenceClass};
}

export function sanitizeCurrentTop25Snapshot(row,{now=new Date()}={}){
  const windowDays=Number(row?.window_days??row?.windowDays);
  if(![7,30].includes(windowDays))return null;
  const windowEnd=validDate(row?.window_end??row?.windowEnd);
  if(!windowEnd)return null;
  const currentNow=validDate(now);if(!currentNow)return null;
  const maxSnapshotAgeMs=24*60*60*1000+5*60*1000;
  if(currentNow.getTime()-windowEnd.getTime()>maxSnapshotAgeMs||windowEnd.getTime()-currentNow.getTime()>5*60*1000)return null;
  const rights=upper(row?.source_rights_status??row?.sourceRightsStatus);
  if(!APPROVED_RIGHTS.has(rights))return null;
  const products=Array.isArray(row?.products)?row.products:[];
  if(products.length>25)return null;
  const sanitized=products.map((product,index)=>sanitizeProduct(product,index,{windowDays,windowEnd}));
  if(sanitized.some(product=>product===null))return null;
  const identities=sanitized.map(product=>product.externalId);
  if(new Set(identities).size!==identities.length)return null;
  const evidenceClass=upper(row?.evidence_class??row?.evidenceClass);
  if(!EVIDENCE.has(evidenceClass))return null;
  const productCount=sanitized.length;
  return {
    nicheId:upper(row?.niche_id??row?.nicheId),
    platform:upper(row?.platform),
    market:upper(row?.market),
    windowDays,
    windowEnd:windowEnd.toISOString(),
    products:sanitized,
    productCount,
    coverage:`${productCount}/25`,
    complete:productCount===25,
    evidenceClass:productCount===25?evidenceClass:'INSUFFICIENT_DATA',
    freshnessStatus:productCount===25?'CURRENT':'INSUFFICIENT_DATA',
    sourceKey:clean(row?.source_key??row?.sourceKey),
    sourceLabel:clean(row?.source_label??row?.sourceLabel),
    sourceRightsStatus:rights
  };
}

export function buildCurrentTop25PublicCoverage(rows,{windowDays,now=new Date(),requiredNiches=[]}={}){
  const requestedWindow=Number(windowDays);
  if(![7,30].includes(requestedWindow))throw new Error('CURRENT_TOP25_WINDOW_INVALID');
  const latest=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const sanitized=sanitizeCurrentTop25Snapshot(row,{now});
    if(!sanitized||sanitized.windowDays!==requestedWindow)continue;
    const key=sanitized.nicheId;
    const previous=latest.get(key);
    if(!previous||sanitized.windowEnd>previous.windowEnd)latest.set(key,sanitized);
  }
  const ordered=(requiredNiches.length?requiredNiches.map(upper):[...latest.keys()].sort()).map(nicheId=>latest.get(nicheId)||{nicheId,windowDays:requestedWindow,products:[],productCount:0,coverage:'0/25',complete:false,evidenceClass:'INSUFFICIENT_DATA',freshnessStatus:'INSUFFICIENT_DATA',sourceRightsStatus:null});
  const totalPositions=ordered.reduce((sum,row)=>sum+row.productCount,0);
  const completeNiches=ordered.filter(row=>row.complete).length;
  return {
    windowDays:requestedWindow,
    nicheCount:ordered.length,
    completeNicheCount:completeNiches,
    totalPositions,
    requiredPositions:ordered.length*25,
    complete:ordered.length>0&&completeNiches===ordered.length,
    niches:ordered,
    policy:{historicalFallback:false,unknownRemainsUnknown:true,requiredPerNiche:25}
  };
}

export const CURRENT_TOP25_PUBLIC_POLICY=Object.freeze({approvedRights:[...APPROVED_RIGHTS],windows:[7,30],maxPositionsPerNiche:25,historicalFallback:false});
