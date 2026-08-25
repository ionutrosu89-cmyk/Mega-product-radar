const text=v=>String(v??'').trim();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const iso=v=>{const s=text(v);if(!s)return null;const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString();};

const LIVE_CLASSES=new Set(['LIVE_PUBLIC_PAGE','LIVE_OFFICIAL_API','LIVE_VERIFIED_PROVIDER']);

export function normalizeProductSnapshot(input={}){
  const platform=text(input.platform).toUpperCase();
  const externalId=text(input.externalId).toUpperCase();
  const observedAt=iso(input.observedAt);
  const freshnessClass=text(input.freshnessClass).toUpperCase();
  const errors=[];
  if(!platform)errors.push('PLATFORM_REQUIRED');
  if(!externalId)errors.push('EXTERNAL_ID_REQUIRED');
  if(!observedAt)errors.push('OBSERVED_AT_REQUIRED');
  if(!freshnessClass)errors.push('FRESHNESS_CLASS_REQUIRED');
  const snapshot={
    platform,externalId,observedAt,freshnessClass,
    price:num(input.price),currency:text(input.currency).toUpperCase()||null,
    rating:num(input.rating),reviewCount:num(input.reviewCount),sourceRank:num(input.sourceRank),
    sourceKey:text(input.sourceKey)||null,evidenceClass:text(input.evidenceClass)||null,
    liveEvidence:LIVE_CLASSES.has(freshnessClass),salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  };
  if(snapshot.sourceRank!==null&&(!Number.isInteger(snapshot.sourceRank)||snapshot.sourceRank<1))errors.push('SOURCE_RANK_INVALID');
  if(snapshot.reviewCount!==null&&snapshot.reviewCount<0)errors.push('REVIEW_COUNT_INVALID');
  if(snapshot.rating!==null&&(snapshot.rating<0||snapshot.rating>5))errors.push('RATING_INVALID');
  return{ok:errors.length===0,errors,snapshot};
}

export function appendProductSnapshots(existing=[],incoming=[]){
  const accepted=[];const rejected=[];const seen=new Set();
  for(const raw of [...(existing||[]),...(incoming||[])]){
    const n=normalizeProductSnapshot(raw);
    if(!n.ok){rejected.push({input:raw,errors:n.errors});continue;}
    const x=n.snapshot;const key=`${x.platform}:${x.externalId}:${x.observedAt}`;
    if(seen.has(key)){rejected.push({input:raw,errors:['DUPLICATE_SNAPSHOT']});continue;}
    seen.add(key);accepted.push(x);
  }
  accepted.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  return{snapshots:accepted,rejected,appendOnly:true,paidCallsTriggered:0,purchaseAuthorized:false};
}

const daysBetween=(a,b)=>(new Date(b)-new Date(a))/86400000;
const rate=(before,after,days)=>before===null||after===null||!Number.isFinite(days)||days<=0?null:(after-before)/days;

export function buildProductHistoryMetrics(snapshots=[]){
  const rows=(snapshots||[]).map(x=>normalizeProductSnapshot(x)).filter(x=>x.ok).map(x=>x.snapshot).sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  const byProduct=new Map();
  for(const row of rows){const k=`${row.platform}:${row.externalId}`;if(!byProduct.has(k))byProduct.set(k,[]);byProduct.get(k).push(row);}
  const products=[];
  for(const [identity,history] of byProduct){
    const live=history.filter(x=>x.liveEvidence);
    const baseline=history.filter(x=>!x.liveEvidence);
    if(live.length<2){
      products.push({identity,status:'INSUFFICIENT_FRESH_HISTORY',totalSnapshots:history.length,liveSnapshots:live.length,baselineSnapshots:baseline.length,rankVelocityPerDay:null,reviewVelocityPerDay:null,priceMovementPerDay:null,eligibleForTrend:false,salesEvidenceClass:'NOT_VERIFIED_SALES'});
      continue;
    }
    const first=live[0],last=live.at(-1),days=daysBetween(first.observedAt,last.observedAt);
    const rankVelocity=first.sourceRank!==null&&last.sourceRank!==null&&days>0?(first.sourceRank-last.sourceRank)/days:null;
    products.push({
      identity,status:days>0?'FRESH_HISTORY_READY':'INSUFFICIENT_TIME_SEPARATION',
      totalSnapshots:history.length,liveSnapshots:live.length,baselineSnapshots:baseline.length,
      observationDays:days>0?days:null,
      rankVelocityPerDay:days>0?rankVelocity:null,
      reviewVelocityPerDay:days>0?rate(first.reviewCount,last.reviewCount,days):null,
      priceMovementPerDay:days>0?rate(first.price,last.price,days):null,
      eligibleForTrend:days>0,
      salesEvidenceClass:'NOT_VERIFIED_SALES'
    });
  }
  return{productCount:products.length,trendReadyCount:products.filter(x=>x.eligibleForTrend).length,products,rule:'TREND_REQUIRES_AT_LEAST_TWO_LIVE_SNAPSHOTS_AT_DISTINCT_TIMES',paidCallsTriggered:0,purchaseAuthorized:false};
}

export function buildSnapshotRefreshPlan(products=[],{batchSize=100,maxProducts=1000}={}){
  const size=Math.max(1,Math.min(250,Number(batchSize)||100));
  const limit=Math.max(1,Math.min(5000,Number(maxProducts)||1000));
  const eligible=(products||[]).filter(x=>text(x.platform)&&text(x.externalId)).slice(0,limit);
  const batches=[];
  for(let i=0;i<eligible.length;i+=size){
    batches.push({batchNumber:batches.length+1,productCount:Math.min(size,eligible.length-i),products:eligible.slice(i,i+size).map(x=>({platform:text(x.platform).toUpperCase(),externalId:text(x.externalId).toUpperCase(),url:text(x.url)||null})),executeAutomatically:false,paid:false});
  }
  return{productCount:eligible.length,batchSize:size,batchCount:batches.length,batches,requiresExplicitExecutionApproval:true,approvedSpendEur:0,paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false};
}
