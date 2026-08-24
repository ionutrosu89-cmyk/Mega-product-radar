import {productHistoryMetrics} from './public-collection-history.js';
import {buildNewEntrantsFeed} from './new-entrants-detector.js';

const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const median=xs=>{const a=xs.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

function latestCategoryByIdentity(history=[]){
  const map=new Map();
  for(const row of history||[]){
    if(!row?.identity)continue;
    const t=Date.parse(row.observedAt);
    if(!Number.isFinite(t))continue;
    const current=map.get(row.identity);
    if(!current||t>current.t)map.set(row.identity,{t,category:text(row.categoryLabel)||'UNCLASSIFIED'});
  }
  return map;
}

function categorySignal(score,parts){
  if(parts.productsWithTrend<2)return 'INSUFFICIENT_DEPTH';
  if(score>=70&&parts.risingSharePct>=50)return 'SURGING';
  if(score>=55&&parts.risingSharePct>=35)return 'RISING';
  if(parts.coolingSharePct>=50)return 'COOLING';
  return 'STABLE_OR_MIXED';
}

export function buildCategoryMomentum(history=[],options={}){
  const categoryMap=latestCategoryByIdentity(history);
  const identities=[...categoryMap.keys()];
  const entrants=buildNewEntrantsFeed(history,options.newEntrants||{}).rows;
  const entrantSet=new Set(entrants.map(x=>x.identity));
  const metrics=identities.map(identity=>({identity,category:categoryMap.get(identity)?.category||'UNCLASSIFIED',...productHistoryMetrics(history,identity)})).filter(x=>x.observationCount>=2);
  const grouped=new Map();
  for(const row of metrics){if(!grouped.has(row.category))grouped.set(row.category,[]);grouped.get(row.category).push(row);}
  const rows=[];
  for(const [category,items] of grouped){
    const rankVel=items.map(x=>n(x.rankVelocityPerDay)).filter(Number.isFinite);
    const reviewVel=items.map(x=>n(x.reviewVelocityPerDay)).filter(Number.isFinite);
    const rising=items.filter(x=>(n(x.rankVelocityPerDay)??0)>0).length;
    const risingFast=items.filter(x=>(n(x.rankVelocityPerDay)??0)>=1).length;
    const cooling=items.filter(x=>(n(x.rankVelocityPerDay)??0)<0).length;
    const newEntrants=items.filter(x=>entrantSet.has(x.identity)).length;
    const productsWithTrend=items.length;
    const risingSharePct=productsWithTrend?Number((rising/productsWithTrend*100).toFixed(1)):0;
    const coolingSharePct=productsWithTrend?Number((cooling/productsWithTrend*100).toFixed(1)):0;
    const entrantSharePct=productsWithTrend?Number((newEntrants/productsWithTrend*100).toFixed(1)):0;
    const medianRankVelocity=median(rankVel);
    const medianReviewVelocity=median(reviewVel);
    const rankComponent=medianRankVelocity===null?0:clamp(medianRankVelocity<=0?0:medianRankVelocity>=3?100:medianRankVelocity/3*100);
    const breadthComponent=clamp(risingSharePct);
    const entrantComponent=clamp(entrantSharePct*1.5);
    const reviewComponent=medianReviewVelocity===null?0:clamp(medianReviewVelocity<=0?0:medianReviewVelocity>=10?100:medianReviewVelocity/10*100);
    const depthComponent=clamp(productsWithTrend>=20?100:productsWithTrend/20*100);
    const score=Number((rankComponent*0.35+breadthComponent*0.25+entrantComponent*0.15+reviewComponent*0.15+depthComponent*0.10).toFixed(1));
    const confidence=Number((depthComponent*0.65+clamp((rankVel.length/productsWithTrend)*100)*0.35).toFixed(1));
    const parts={productsWithTrend,rising,risingFast,cooling,newEntrants,risingSharePct,coolingSharePct,entrantSharePct};
    rows.push({category,momentumScore:score,momentumConfidence:confidence,signal:categorySignal(score,parts),...parts,medianRankVelocity:medianRankVelocity===null?null:Number(medianRankVelocity.toFixed(3)),medianReviewVelocity:medianReviewVelocity===null?null:Number(medianReviewVelocity.toFixed(3)),avgTop100PersistencePct:avg(items.map(x=>n(x.top100PersistencePct)).filter(Number.isFinite))===null?null:Number(avg(items.map(x=>n(x.top100PersistencePct)).filter(Number.isFinite)).toFixed(1)),salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false});
  }
  const priority={SURGING:0,RISING:1,STABLE_OR_MIXED:2,COOLING:3,INSUFFICIENT_DEPTH:4};
  rows.sort((a,b)=>(priority[a.signal]??9)-(priority[b.signal]??9)||b.momentumScore-a.momentumScore||b.momentumConfidence-a.momentumConfidence);
  return{categoriesTracked:rows.length,productsWithTrend:metrics.length,surging:rows.filter(x=>x.signal==='SURGING').length,rising:rows.filter(x=>x.signal==='RISING').length,cooling:rows.filter(x=>x.signal==='COOLING').length,rows,semantics:'CATEGORY_MOMENTUM_FROM_MPR_OBSERVED_PUBLIC_RANKING_HISTORY',policy:'MOMENTUM_INTELLIGENCE_NOT_VERIFIED_SALES',paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false};
}
