import {sourceIdentity} from './public-rankings-acquisition.js';

const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const numberOrNull=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const isoOrNull=v=>{const s=text(v);if(!s)return null;const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toISOString():null;};

export const PUBLIC_COLLECTION_CADENCE=Object.freeze({
  AMAZON_BEST_SELLERS:{intervalHours:24,priority:'HIGH'},
  AMAZON_NEW_RELEASES:{intervalHours:24,priority:'HIGH'},
  AMAZON_MOVERS_SHAKERS:{intervalHours:12,priority:'HIGH'},
  ALIBABA_TOP_RANKING:{intervalHours:24,priority:'HIGH'},
  EBAY_BEST_SELLING:{intervalHours:24,priority:'HIGH'},
  ETSY_OPEN_API:{intervalHours:168,priority:'BREADTH'},
  WALMART_CATALOG_SEARCH:{intervalHours:168,priority:'BREADTH'}
});

export function buildCollectionSchedule({sourceKeys=[],lastCollectedAt={},now=new Date().toISOString()}={}){
  const nowMs=Date.parse(now);if(!Number.isFinite(nowMs))return{ok:false,error:'NOW_INVALID',tasks:[]};
  const keys=[...new Set((sourceKeys||[]).map(x=>text(x).toUpperCase()).filter(Boolean))];
  const tasks=[];const rejected=[];
  for(const sourceKey of keys){
    const policy=PUBLIC_COLLECTION_CADENCE[sourceKey];
    if(!policy){rejected.push({sourceKey,error:'CADENCE_NOT_DEFINED'});continue;}
    const last=isoOrNull(lastCollectedAt?.[sourceKey]);
    const dueAt=last?new Date(Date.parse(last)+policy.intervalHours*3600000).toISOString():new Date(nowMs).toISOString();
    const due=Date.parse(dueAt)<=nowMs;
    tasks.push({sourceKey,intervalHours:policy.intervalHours,priority:policy.priority,lastCollectedAt:last,dueAt,due,executeAutomatically:false});
  }
  tasks.sort((a,b)=>Number(b.due)-Number(a.due)||Date.parse(a.dueAt)-Date.parse(b.dueAt)||a.sourceKey.localeCompare(b.sourceKey));
  return{ok:true,now:new Date(nowMs).toISOString(),tasks,rejected,dueCount:tasks.filter(x=>x.due).length,paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false};
}

export function normalizeSnapshot(record={}){
  const identity=sourceIdentity(record);
  const observedAt=isoOrNull(record.observedAt);
  if(!identity)return{ok:false,error:'SOURCE_IDENTITY_REQUIRED'};
  if(!observedAt)return{ok:false,error:'OBSERVED_AT_REQUIRED'};
  const rank=numberOrNull(record.sourceRank);
  if(rank!==null&&(!Number.isInteger(rank)||rank<1))return{ok:false,error:'RANK_INVALID'};
  return{ok:true,snapshot:{
    identity,sourceKey:text(record.sourceKey).toUpperCase()||null,platform:text(record.platform).toUpperCase()||null,surface:text(record.surface).toUpperCase()||null,
    observedAt,sourceRank:rank,price:numberOrNull(record.price),currency:text(record.currency).toUpperCase()||null,rating:numberOrNull(record.rating),reviewCount:numberOrNull(record.reviewCount),
    title:text(record.title)||null,brand:text(record.brand)||null,seller:text(record.seller)||null,categoryLabel:text(record.categoryLabel)||null,
    evidenceClass:'PUBLIC_MARKET_SNAPSHOT',salesEvidenceClass:'NOT_VERIFIED_SALES',appendOnly:true,purchaseAuthorized:false
  }};
}

export function appendSnapshots(history=[],records=[]){
  const out=[...(history||[])];const rejected=[];const seen=new Set(out.map(x=>`${x.identity}|${x.observedAt}|${x.sourceKey||''}`));
  for(const record of records||[]){
    const n=normalizeSnapshot(record);
    if(!n.ok){rejected.push({record,error:n.error});continue;}
    const key=`${n.snapshot.identity}|${n.snapshot.observedAt}|${n.snapshot.sourceKey||''}`;
    if(seen.has(key))continue;
    seen.add(key);out.push(n.snapshot);
  }
  out.sort((a,b)=>a.identity.localeCompare(b.identity)||Date.parse(a.observedAt)-Date.parse(b.observedAt));
  return{history:out,rejected,added:out.length-(history||[]).length,appendOnly:true,purchaseAuthorized:false};
}

function pctDelta(from,to){if(from===null||to===null||from===0)return null;return Number(((to-from)/Math.abs(from)*100).toFixed(2));}

export function productHistoryMetrics(history=[],identity){
  const rows=(history||[]).filter(x=>x.identity===identity).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  if(!rows.length)return{identity,observationCount:0,status:'NO_HISTORY'};
  const first=rows[0],latest=rows.at(-1);
  const rankDelta=first.sourceRank!==null&&latest.sourceRank!==null?first.sourceRank-latest.sourceRank:null;
  const reviewDelta=first.reviewCount!==null&&latest.reviewCount!==null?latest.reviewCount-first.reviewCount:null;
  const priceDeltaPct=pctDelta(first.price,latest.price);
  const days=Math.max(0,(Date.parse(latest.observedAt)-Date.parse(first.observedAt))/86400000);
  const rankVelocityPerDay=rankDelta!==null&&days>0?Number((rankDelta/days).toFixed(3)):null;
  const reviewVelocityPerDay=reviewDelta!==null&&days>0?Number((reviewDelta/days).toFixed(3)):null;
  const ranked=rows.filter(x=>x.sourceRank!==null);
  const top10Hits=ranked.filter(x=>x.sourceRank<=10).length;
  const top100Hits=ranked.filter(x=>x.sourceRank<=100).length;
  return{
    identity,observationCount:rows.length,firstSeenAt:first.observedAt,lastSeenAt:latest.observedAt,daysObserved:Number(days.toFixed(2)),
    firstRank:first.sourceRank,latestRank:latest.sourceRank,rankDelta,rankVelocityPerDay,
    firstReviews:first.reviewCount,latestReviews:latest.reviewCount,reviewDelta,reviewVelocityPerDay,
    firstPrice:first.price,latestPrice:latest.price,priceDeltaPct,
    top10PersistencePct:ranked.length?Number((top10Hits/ranked.length*100).toFixed(1)):null,
    top100PersistencePct:ranked.length?Number((top100Hits/ranked.length*100).toFixed(1)):null,
    trendSignal:rankVelocityPerDay!==null&&rankVelocityPerDay>=1?'RISING_FAST':rankVelocityPerDay!==null&&rankVelocityPerDay>0?'RISING':rankVelocityPerDay!==null&&rankVelocityPerDay<0?'FALLING':'STABLE_OR_UNKNOWN',
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  };
}

export function buildHistoryRadarFeed(history=[]){
  const identities=[...new Set((history||[]).map(x=>x.identity).filter(Boolean))];
  const rows=identities.map(id=>productHistoryMetrics(history,id)).filter(x=>x.observationCount>=2);
  rows.sort((a,b)=>(b.rankVelocityPerDay??-Infinity)-(a.rankVelocityPerDay??-Infinity)||(b.reviewVelocityPerDay??-Infinity)-(a.reviewVelocityPerDay??-Infinity));
  return{productsTracked:identities.length,productsWithTrend:rows.length,risingFast:rows.filter(x=>x.trendSignal==='RISING_FAST').length,rows,policy:'HISTORY_SIGNALS_NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false};
}
