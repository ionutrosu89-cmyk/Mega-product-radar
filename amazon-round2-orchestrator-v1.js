const clean=v=>String(v??'').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};

export function parseCompactAmazonSnapshots(payload={}){
  const fields=Array.isArray(payload.fields)?payload.fields:[];
  const rows=Array.isArray(payload.snapshots)?payload.snapshots:[];
  const index=Object.fromEntries(fields.map((name,i)=>[name,i]));
  return rows.map(row=>({
    asin:clean(row[index.asin]).toUpperCase(),
    title:clean(row[index.title])||null,
    price:num(row[index.price]),
    currency:clean(row[index.currency])||null,
    rating:num(row[index.rating]),
    reviewCount:num(row[index.reviewCount]),
    observedAt:iso(row[index.observedAt]),
    sourceRank:null,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false
  })).filter(x=>x.asin&&x.observedAt);
}

export function buildAmazonRound2Plan(payloads=[],nowIso=new Date().toISOString(),minIntervalHours=24){
  const nowMs=Date.parse(nowIso);
  if(!Number.isFinite(nowMs)) throw new Error('INVALID_NOW');
  const minMs=Math.max(24,Number(minIntervalHours)||24)*3600000;
  const latest=new Map();
  for(const payload of payloads||[]){
    for(const row of parseCompactAmazonSnapshots(payload)){
      const prev=latest.get(row.asin);
      if(!prev||row.observedAt>prev.observedAt) latest.set(row.asin,row);
    }
  }
  const captured=[...latest.values()].sort((a,b)=>a.asin.localeCompare(b.asin));
  const eligible=[];const blocked=[];
  for(const row of captured){
    const firstMs=Date.parse(row.observedAt);
    const eligibleAtMs=firstMs+minMs;
    const item={...row,eligibleAt:new Date(eligibleAtMs).toISOString(),elapsedHours:Math.floor(((nowMs-firstMs)/3600000)*100)/100};
    if(nowMs>=eligibleAtMs) eligible.push(item); else blocked.push(item);
  }
  const nextEligibleAt=blocked.length?blocked.map(x=>x.eligibleAt).sort()[0]:null;
  const allEligibleAt=captured.length?new Date(Math.max(...captured.map(x=>Date.parse(x.observedAt)+minMs))).toISOString():null;
  return {
    version:'1.0',
    now:new Date(nowMs).toISOString(),
    minIntervalHours:Math.max(24,Number(minIntervalHours)||24),
    capturedCount:captured.length,
    eligibleCount:eligible.length,
    blockedCount:blocked.length,
    nextEligibleAt,
    allEligibleAt,
    captured,
    eligible,
    blocked,
    policy:'ROUND2_ONLY_FOR_EXISTING_LIVE_ASINS; MINIMUM_24H; NO_RANK_VELOCITY_WITHOUT_RANK_EVIDENCE; NOT_VERIFIED_SALES; NO_PURCHASE_AUTHORIZATION',
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}

export function deriveAmazonRound2Movement(previous={},current={}){
  const prevAt=Date.parse(previous.observedAt||'');
  const curAt=Date.parse(current.observedAt||'');
  const elapsedMs=curAt-prevAt;
  const elapsedHours=Number.isFinite(elapsedMs)?elapsedMs/3600000:null;
  const intervalEligible=elapsedHours!==null&&elapsedHours>=24;
  const daysObserved=intervalEligible?Math.round((elapsedHours/24)*1000)/1000:null;
  const prevPrice=num(previous.price),curPrice=num(current.price);
  const prevReviews=num(previous.reviewCount),curReviews=num(current.reviewCount);
  const priceDelta=intervalEligible&&prevPrice!==null&&curPrice!==null?Math.round((curPrice-prevPrice)*100)/100:null;
  const reviewDelta=intervalEligible&&prevReviews!==null&&curReviews!==null?curReviews-prevReviews:null;
  const reviewVelocityPerDay=reviewDelta!==null&&daysObserved>0?Math.round((reviewDelta/daysObserved)*1000)/1000:null;
  return {
    asin:clean(current.externalId||current.asin||previous.asin).toUpperCase(),
    previousObservedAt:iso(previous.observedAt),
    currentObservedAt:iso(current.observedAt),
    elapsedHours:elapsedHours===null?null:Math.round(elapsedHours*1000)/1000,
    daysObserved,
    intervalEligible,
    pricePrevious:prevPrice,
    priceCurrent:curPrice,
    priceDelta,
    reviewCountPrevious:prevReviews,
    reviewCountCurrent:curReviews,
    reviewDelta,
    reviewVelocityPerDay,
    sourceRankPrevious:null,
    sourceRankCurrent:null,
    rankVelocity:null,
    trendEvidenceClass:intervalEligible?'LONGITUDINAL_PUBLIC_PRODUCT_PAGE':'INSUFFICIENT_INTERVAL',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false
  };
}

export function summarizeAmazonRound2Movements(movements=[]){
  const valid=(movements||[]).filter(x=>x.intervalEligible);
  return {
    compared:valid.length,
    withPriceDelta:valid.filter(x=>x.priceDelta!==null).length,
    withReviewDelta:valid.filter(x=>x.reviewDelta!==null).length,
    positiveReviewDelta:valid.filter(x=>x.reviewDelta>0).length,
    negativeReviewDelta:valid.filter(x=>x.reviewDelta<0).length,
    unchangedReviews:valid.filter(x=>x.reviewDelta===0).length,
    rankVelocityAvailable:0,
    verifiedSalesRows:0,
    purchaseAuthorized:false,
    paidCallsTriggered:0
  };
}
