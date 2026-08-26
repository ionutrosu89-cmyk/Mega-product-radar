import {normalizeMarketObservation} from './market-observation-v1.js';

const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const hoursBetween=(a,b)=>(Date.parse(b)-Date.parse(a))/3600000;
const text=v=>String(v??'').trim();
const seriesKey=x=>`${x.canonicalProductId?`canonical:${x.canonicalProductId}`:'unbound'}|${x.platform}|${x.externalId}|${x.surface||'DEFAULT'}`;

export const TREND_WINDOWS_V2=Object.freeze([
  Object.freeze({key:'24H',hours:24,weight:0.35}),
  Object.freeze({key:'7D',hours:24*7,weight:0.35}),
  Object.freeze({key:'30D',hours:24*30,weight:0.20}),
  Object.freeze({key:'90D',hours:24*90,weight:0.10})
]);

function normalizeSeries(history=[]){
  const groups=new Map();
  for(const raw of history||[]){
    const n=normalizeMarketObservation(raw);
    if(!n.ok)continue;
    const x=n.observation,k=seriesKey(x);
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(x);
  }
  return [...groups.entries()].map(([key,rows])=>({key,rows:rows.sort((a,b)=>a.observedAt.localeCompare(b.observedAt))}));
}

function baselineForWindow(rows,windowHours){
  if(rows.length<2)return null;
  const latest=rows.at(-1),cutoff=Date.parse(latest.observedAt)-windowHours*3600000;
  let baseline=null;
  for(const row of rows.slice(0,-1)){
    if(Date.parse(row.observedAt)<=cutoff)baseline=row;
    else break;
  }
  return baseline;
}

function metricDelta(a,b){return a===null||b===null?null:b-a;}

function scoreWindow(rows,window){
  const latest=rows.at(-1),baseline=baselineForWindow(rows,window.hours);
  if(!baseline)return Object.freeze({window:window.key,windowHours:window.hours,available:false,score:null,baselineObservedAt:null,latestObservedAt:latest?.observedAt||null});
  const reviewDelta=metricDelta(baseline.reviewCount,latest.reviewCount);
  const rankDelta=baseline.sourceRank===null||latest.sourceRank===null?null:baseline.sourceRank-latest.sourceRank;
  const priceChangePct=baseline.price===null||latest.price===null||baseline.price===0?null:((latest.price-baseline.price)/baseline.price)*100;
  let score=50,positive=0,negative=0,availableSignals=0;
  if(reviewDelta!==null){availableSignals++;if(reviewDelta>0){score+=20;positive++;}else if(reviewDelta<0){score-=20;negative++;}}
  if(rankDelta!==null){availableSignals++;if(rankDelta>0){score+=20;positive++;}else if(rankDelta<0){score-=20;negative++;}}
  if(priceChangePct!==null){availableSignals++;const abs=Math.abs(priceChangePct);if(abs<=15){score+=10;positive++;}else if(abs>30){score-=10;negative++;}}
  return Object.freeze({
    window:window.key,windowHours:window.hours,available:true,score:clamp(score),baselineObservedAt:baseline.observedAt,latestObservedAt:latest.observedAt,
    reviewDelta,rankImprovement:rankDelta,priceChangePct:priceChangePct===null?null:Number(priceChangePct.toFixed(3)),availableSignals,positiveSignals:positive,negativeSignals:negative,
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null
  });
}

function weightedTrendScore(windows=[]){
  const available=windows.filter(x=>x.available&&Number.isFinite(x.score));
  if(!available.length)return null;
  const map=new Map(TREND_WINDOWS_V2.map(x=>[x.key,x.weight]));
  const totalWeight=available.reduce((s,x)=>s+(map.get(x.window)||0),0);
  if(totalWeight<=0)return null;
  return Number((available.reduce((s,x)=>s+x.score*(map.get(x.window)||0),0)/totalWeight).toFixed(2));
}

function confidence(rows,windows,now){
  const latest=rows.at(-1),first=rows[0];
  if(!latest||!first)return 0;
  const duration=Math.max(0,hoursBetween(first.observedAt,latest.observedAt));
  let maturity=0;if(duration>=24)maturity=20;if(duration>=168)maturity=40;if(duration>=720)maturity=60;if(duration>=2160)maturity=70;
  const density=Math.min(15,rows.length*3);
  const latestCompleteness=[latest.reviewCount,latest.sourceRank,latest.price].filter(v=>v!==null).length/3*10;
  const availableWindows=windows.filter(x=>x.available).length/4*5;
  const nowMs=Date.parse(now),latestMs=Date.parse(latest.observedAt),ageHours=Number.isFinite(nowMs)?Math.max(0,(nowMs-latestMs)/3600000):Infinity;
  const freshness=ageHours<=48?15:ageHours<=168?8:0;
  return clamp(maturity+density+latestCompleteness+availableWindows+freshness);
}

function classify({durationHours,windows,score}){
  const byKey=Object.fromEntries(windows.map(x=>[x.window,x]));
  const w24=byKey['24H'],w7=byKey['7D'],w30=byKey['30D'];
  if(durationHours<24||!w24?.available)return 'INSUFFICIENT_HISTORY';
  if(durationHours<168){if((score??50)>=60)return 'EARLY_SIGNAL';if((score??50)<=40)return 'EARLY_DECLINE';return 'EARLY_MIXED';}
  if(w24?.available&&w7?.available&&w24.score>=65&&w7.score<=50)return 'SPIKE_OR_REVERSAL';
  if(durationHours>=720&&w7?.available&&w30?.available&&w7.score>=60&&w30.score>=60)return 'PERSISTENT_TREND';
  if(w7?.available&&w7.score>=60)return 'EMERGING_TREND';
  if((score??50)<=40)return 'DECLINING';
  return 'MIXED_OR_STABLE';
}

export function analyzeTrendSeries(rows=[],{now=new Date().toISOString()}={}){
  const normalized=[];
  for(const raw of rows||[]){const n=normalizeMarketObservation(raw);if(n.ok)normalized.push(n.observation);}
  normalized.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  if(!normalized.length)return Object.freeze({status:'NO_VALID_OBSERVATIONS',trendScore:null,confidence:0,windows:[],decisionEligible:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false});
  const first=normalized[0],latest=normalized.at(-1),durationHours=normalized.length>=2?hoursBetween(first.observedAt,latest.observedAt):0;
  const windows=TREND_WINDOWS_V2.map(w=>scoreWindow(normalized,w));
  const trendScore=weightedTrendScore(windows);
  const conf=confidence(normalized,windows,now);
  const status=classify({durationHours,windows,score:trendScore});
  return Object.freeze({
    schemaVersion:'MPR_TREND_INTELLIGENCE_V2',seriesKey:seriesKey(latest),canonicalProductId:latest.canonicalProductId||null,decisionEligible:Boolean(latest.canonicalProductId),platform:latest.platform,externalId:latest.externalId,surface:latest.surface||null,
    firstObservedAt:first.observedAt,lastObservedAt:latest.observedAt,observationCount:normalized.length,durationHours:Number(durationHours.toFixed(3)),status,trendScore,confidence:conf,windows:Object.freeze(windows),
    explanation:Object.freeze({spikeIsNotTrend:true,rollingWindows:true,rankDirection:'LOWER_RANK_IS_BETTER',reviewGrowthIsDemand_PROXY_ONLY:true,priceStabilityIsSupportiveNotDemandProof:true}),
    salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null,autoPromoteOpportunityStage:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false
  });
}

export function analyzeTrendHistory(history=[],options={}){
  const analyses=normalizeSeries(history).map(({rows})=>analyzeTrendSeries(rows,options));
  analyses.sort((a,b)=>(b.trendScore??-1)-(a.trendScore??-1)||(b.confidence??0)-(a.confidence??0)||text(a.seriesKey).localeCompare(text(b.seriesKey)));
  return Object.freeze({schemaVersion:'MPR_TREND_INTELLIGENCE_V2_REPORT',seriesCount:analyses.length,analyses:Object.freeze(analyses),policy:'SAME_SOURCE_SURFACE_ONLY; ROLLING_24H_7D_30D_90D; SPIKE_NEVER_EQUALS_TREND; SCORE_AND_CONFIDENCE_SEPARATE; NO_VERIFIED_SALES_INFERENCE',paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false});
}
