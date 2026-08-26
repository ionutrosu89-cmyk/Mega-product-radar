import {normalizeMarketObservation,marketObservationIdentity} from './market-observation-v1.js';

const seriesKey=x=>`${x.canonicalProductId?`canonical:${x.canonicalProductId}`:'unbound'}|${x.platform}|${x.externalId}|${x.surface||'DEFAULT'}`;
const hoursBetween=(a,b)=>(Date.parse(b)-Date.parse(a))/3600000;
const perDay=(a,b,hours)=>a===null||b===null||!Number.isFinite(hours)||hours<=0?null:(b-a)/(hours/24);

export function appendMarketObservationHistory(existing=[],incoming=[]){
  const history=[],rejected=[],seen=new Set();
  for(const raw of[...(existing||[]),...(incoming||[])]){
    const n=normalizeMarketObservation(raw);
    if(!n.ok){rejected.push({input:raw,errors:n.errors});continue;}
    const id=marketObservationIdentity(n.observation);
    if(seen.has(id)){rejected.push({input:raw,errors:['DUPLICATE_OBSERVATION']});continue;}
    seen.add(id);history.push(n.observation);
  }
  history.sort((a,b)=>seriesKey(a).localeCompare(seriesKey(b))||a.observedAt.localeCompare(b.observedAt));
  return{history,rejected,added:Math.max(0,history.length-(existing||[]).length),appendOnly:true,paidCallsTriggered:0,purchaseAuthorized:false};
}

export function observationSeries(history=[]){
  const groups=new Map();
  for(const raw of history||[]){const n=normalizeMarketObservation(raw);if(!n.ok)continue;const x=n.observation,k=seriesKey(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
  return[...groups.entries()].map(([key,rows])=>({key,rows:rows.sort((a,b)=>a.observedAt.localeCompare(b.observedAt))}));
}

export function buildObservationHistoryMetrics(history=[],{minObservationHours=24}={}){
  const minimum=Math.max(1,Math.min(24*30,Number(minObservationHours)||24));
  const metrics=[];
  for(const {key,rows} of observationSeries(history)){
    const first=rows[0],latest=rows.at(-1),hours=rows.length>=2?hoursBetween(first.observedAt,latest.observedAt):null,intervalReady=Number.isFinite(hours)&&hours>=minimum;
    const rankVelocity=intervalReady&&first.sourceRank!==null&&latest.sourceRank!==null?(first.sourceRank-latest.sourceRank)/(hours/24):null;
    metrics.push({
      seriesKey:key,canonicalProductId:first.canonicalProductId,decisionEligible:Boolean(first.canonicalProductId),platform:first.platform,externalId:first.externalId,surface:first.surface,
      observationCount:rows.length,firstObservedAt:first.observedAt,lastObservedAt:latest.observedAt,observationHours:Number.isFinite(hours)?Number(hours.toFixed(3)):null,minObservationHours:minimum,
      status:rows.length<2?'INSUFFICIENT_HISTORY':intervalReady?'LONGITUDINAL_READY':'INSUFFICIENT_OBSERVATION_INTERVAL',eligibleForTrend:intervalReady,
      rankVelocityPerDay:rankVelocity===null?null:Number(rankVelocity.toFixed(6)),reviewVelocityPerDay:intervalReady?perDay(first.reviewCount,latest.reviewCount,hours):null,priceMovementPerDay:intervalReady?perDay(first.price,latest.price,hours):null,
      salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSales:null,purchaseAuthorized:false
    });
  }
  return{seriesCount:metrics.length,longitudinalReady:metrics.filter(x=>x.eligibleForTrend).length,decisionEligibleSeries:metrics.filter(x=>x.decisionEligible).length,metrics,minObservationHours:minimum,policy:'SAME_SOURCE_IDENTITY_AND_SURFACE_ONLY; MINIMUM_INTERVAL_REQUIRED; NO_VERIFIED_SALES_INFERENCE; NO_CROSS_PLATFORM_OR_CROSS_CATEGORY_RANK_FUSION',paidCallsTriggered:0,purchaseAuthorized:false};
}

export function latestMarketObservationView(history=[]){
  return observationSeries(history).map(({key,rows})=>({seriesKey:key,...rows.at(-1)})).sort((a,b)=>a.seriesKey.localeCompare(b.seriesKey));
}
