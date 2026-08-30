import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const parseMs=v=>{const ms=Date.parse(clean(v));return Number.isFinite(ms)?ms:null;};

export function earliestObservedAt(bridge={}){
  const rows=Array.isArray(bridge?.observations)?bridge.observations:[];
  const times=rows.map(x=>parseMs(x?.observedAt)).filter(Number.isFinite);
  return times.length?new Date(Math.min(...times)).toISOString():null;
}

export function metricRefreshReadiness(bridge={},options={}){
  const nowMs=parseMs(options.now||new Date().toISOString());
  const baselineAt=earliestObservedAt(bridge);
  const baselineMs=parseMs(baselineAt);
  const minIntervalMs=Math.max(1,Number(options.minIntervalMs||24*60*60*1000));
  if(nowMs===null)throw new Error('AMAZON_METRIC_NOW_INVALID');
  if(baselineMs===null)throw new Error('AMAZON_METRIC_BASELINE_TIME_REQUIRED');
  const elapsedMs=nowMs-baselineMs;
  return {
    ready:elapsedMs>=minIntervalMs,
    baselineAt,
    now:new Date(nowMs).toISOString(),
    elapsedMs,
    minIntervalMs,
    nextEligibleAt:new Date(baselineMs+minIntervalMs).toISOString()
  };
}

export function buildMetricComparison(bridge={},currentRows=[],options={}){
  if(bridge?.schemaVersion!=='MPR_AMAZON_ROUND1_CANONICAL_BRIDGE_V1')throw new Error('AMAZON_METRIC_BRIDGE_SCHEMA_INVALID');
  const readiness=metricRefreshReadiness(bridge,options);
  if(!readiness.ready)throw new Error(`AMAZON_METRIC_INTERVAL_NOT_REACHED:${readiness.nextEligibleAt}`);
  const baseline=Array.isArray(bridge.observations)?bridge.observations:[];
  const byId=new Map((Array.isArray(currentRows)?currentRows:[]).map(x=>[clean(x?.externalId).toUpperCase(),x]));
  const comparisons=[];
  for(const base of baseline){
    const externalId=clean(base?.externalId).toUpperCase();
    if(!externalId)continue;
    const current=byId.get(externalId)||null;
    const currentAt=parseMs(current?.observedAt);
    const baseAt=parseMs(base?.observedAt);
    const intervalMs=currentAt!==null&&baseAt!==null?currentAt-baseAt:null;
    const comparable=Boolean(current)&&intervalMs!==null&&intervalMs>=readiness.minIntervalMs;
    const price0=finite(base?.price),price1=finite(current?.price);
    const rating0=finite(base?.rating),rating1=finite(current?.rating);
    const reviews0=finite(base?.reviewCount),reviews1=finite(current?.reviewCount);
    const row={
      canonicalKey:clean(base?.canonicalKey)||`AMAZON:AMAZON:${externalId}`,
      externalId,
      baselineObservedAt:base?.observedAt||null,
      currentObservedAt:current?.observedAt||null,
      intervalMs,
      comparable,
      baseline:{price:price0,currency:base?.currency||null,rating:rating0,reviewCount:reviews0},
      current:current?{price:price1,currency:current?.currency||null,rating:rating1,reviewCount:reviews1}:null,
      delta:comparable?{
        price:price0!==null&&price1!==null?price1-price0:null,
        rating:rating0!==null&&rating1!==null?rating1-rating0:null,
        reviewCount:reviews0!==null&&reviews1!==null?reviews1-reviews0:null
      }:null,
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      reviewGrowthIsSales:false,
      demandTrendAuthorized:false,
      purchaseAuthorized:false
    };
    comparisons.push({...row,fingerprint:deterministicFingerprint(row)});
  }
  const comparableCount=comparisons.filter(x=>x.comparable).length;
  const reviewDeltaKnownCount=comparisons.filter(x=>x.comparable&&x.delta?.reviewCount!==null).length;
  const priceDeltaKnownCount=comparisons.filter(x=>x.comparable&&x.delta?.price!==null).length;
  const ratingDeltaKnownCount=comparisons.filter(x=>x.comparable&&x.delta?.rating!==null).length;
  const manifest={
    schema:'MPR_AMAZON_METRIC_COMPARISON_V1',
    baselineCount:baseline.length,
    currentValidCount:byId.size,
    comparableCount,
    missingCurrentCount:Math.max(0,baseline.length-comparableCount),
    priceDeltaKnownCount,
    ratingDeltaKnownCount,
    reviewDeltaKnownCount,
    minIntervalMs:readiness.minIntervalMs,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    reviewGrowthIsSales:false,
    demandTrendAuthorized:false,
    providerSpendEur:0,
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
  return {schemaVersion:'MPR_AMAZON_METRIC_COMPARISON_V1',generatedAt:new Date().toISOString(),readiness,manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},comparisons,policy:{comparisonAuthorized:true,salesEvidenceClass:'NOT_VERIFIED_SALES',reviewGrowthIsSales:false,demandTrendAuthorized:false,crossPlatformAutoMerge:false,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,scaleAuthorized:false}};
}
