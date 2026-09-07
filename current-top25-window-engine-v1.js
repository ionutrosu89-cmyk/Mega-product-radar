const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const dayKey=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10);};
const finite=value=>Number.isFinite(Number(value));

function normalizeSnapshot(snapshot){
  const observedAt=clean(snapshot?.observedAt||snapshot?.windowEnd||snapshot?.reviewedAt);
  const date=new Date(observedAt);
  if(Number.isNaN(date.getTime()))return null;
  const products=Array.isArray(snapshot?.products)?snapshot.products:[];
  if(products.length!==25)return null;
  return {observedAt:date.toISOString(),day:dayKey(date),products};
}

function productIdentity(product){return upper(product?.externalId||product?.asin||product?.productId||product?.epid);}

export function buildCurrentTop25Window({snapshots=[],windowDays=7,windowEnd=new Date(),platform='UNKNOWN',market='UNKNOWN',nicheId='UNKNOWN'}={}){
  if(![7,30].includes(Number(windowDays)))throw new Error('CURRENT_TOP25_WINDOW_INVALID');
  const end=new Date(windowEnd);
  if(Number.isNaN(end.getTime()))throw new Error('CURRENT_TOP25_WINDOW_END_INVALID');
  const startMs=end.getTime()-Number(windowDays)*86400000;
  const normalized=snapshots.map(normalizeSnapshot).filter(Boolean).filter(row=>{
    const time=new Date(row.observedAt).getTime();return time>startMs&&time<=end.getTime();
  });
  const byDay=new Map();
  for(const row of normalized){const previous=byDay.get(row.day);if(!previous||row.observedAt>previous.observedAt)byDay.set(row.day,row);}
  const observations=[...byDay.values()].sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  const products=new Map();
  for(const snapshot of observations){
    snapshot.products.forEach((product,index)=>{
      const id=productIdentity(product);if(!id)return;
      const rank=Number(product.rank)||index+1;if(rank<1||rank>25)return;
      const entry=products.get(id)||{id,name:clean(product.name||product.title),sourceUrl:clean(product.sourceUrl),latestObservedAt:snapshot.observedAt,latestRank:rank,ranks:[],days:new Set(),sourceKey:clean(product.sourceKey),sourceLabel:clean(product.sourceLabel),evidenceClass:clean(product.evidenceClass||'DIRECT'),salesEvidenceClass:clean(product.salesEvidenceClass)};
      entry.ranks.push(rank);entry.days.add(snapshot.day);
      if(snapshot.observedAt>=entry.latestObservedAt){entry.latestObservedAt=snapshot.observedAt;entry.latestRank=rank;entry.name=clean(product.name||product.title)||entry.name;entry.sourceUrl=clean(product.sourceUrl)||entry.sourceUrl;}
      products.set(id,entry);
    });
  }
  const observedDays=observations.length;
  const rows=[...products.values()].map(entry=>{
    const averageRank=entry.ranks.reduce((sum,rank)=>sum+rank,0)/entry.ranks.length;
    const bestRank=Math.min(...entry.ranks),worstRank=Math.max(...entry.ranks);
    const persistenceDays=entry.days.size;
    const persistenceRate=observedDays? persistenceDays/observedDays:0;
    const rankQuality=Math.max(0,(26-averageRank)/25);
    const persistenceScore=observedDays?Math.min(1,persistenceRate):0;
    const windowScore=Number((rankQuality*0.65+persistenceScore*0.35).toFixed(6));
    return {name:entry.name,externalId:entry.id,platform:upper(platform),market:upper(market),nicheId:upper(nicheId),windowDays:Number(windowDays),observedAt:entry.latestObservedAt,sourceUrl:entry.sourceUrl,sourceKey:entry.sourceKey,sourceLabel:entry.sourceLabel,rankingBasis:'WINDOW_PERSISTENCE_FROM_DIRECT_PLATFORM_RANK',evidenceClass:'DERIVED',salesEvidenceClass:entry.salesEvidenceClass||'PLATFORM_RANK_NOT_UNIT_SALES',windowMetrics:{windowScore,averageRank:Number(averageRank.toFixed(3)),bestRank,worstRank,latestRank:entry.latestRank,persistenceDays,observedDays,persistenceRate:Number(persistenceRate.toFixed(4))}};
  }).sort((a,b)=>b.windowMetrics.windowScore-a.windowMetrics.windowScore||a.windowMetrics.averageRank-b.windowMetrics.averageRank||a.externalId.localeCompare(b.externalId)).slice(0,25).map((row,index)=>({...row,rank:index+1}));
  return {
    nicheId:upper(nicheId),platform:upper(platform),market:upper(market),windowDays:Number(windowDays),windowEnd:end.toISOString(),windowStart:new Date(startMs).toISOString(),observedDays,coverageDays:Number((observedDays/Number(windowDays)).toFixed(4)),productCount:rows.length,evidenceClass:rows.length===25?'DERIVED':'INSUFFICIENT_DATA',freshnessStatus:rows.length===25?'CURRENT':'INSUFFICIENT_DATA',products:rows
  };
}

export function compareCurrentWindows(top7d,top30d){
  const thirty=new Map((top30d?.products||[]).map(product=>[product.externalId,product]));
  return (top7d?.products||[]).map(product=>{
    const prior=thirty.get(product.externalId)||null;
    const rankDelta=prior?prior.rank-product.rank:null;
    const scoreDelta=prior&&finite(prior?.windowMetrics?.windowScore)?Number((product.windowMetrics.windowScore-prior.windowMetrics.windowScore).toFixed(6)):null;
    return {...product,acceleration:{rankDelta,scoreDelta,direction:rankDelta===null?'NEW':rankDelta>0?'UP':rankDelta<0?'DOWN':'FLAT'}};
  });
}
