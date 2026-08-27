import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};

export function evaluateTrendHandoffEligibility(trend={},options={}){
  const asOfMs=parseTime(options.asOf||new Date().toISOString());
  const maxAgeMs=Math.max(1,Number(options.maxAgeMs||7*24*60*60*1000));
  const lastObservedMs=parseTime(trend.lastObservedAt);
  const sampleCount=Math.max(0,Number(trend.sampleCount||0));
  const velocity=finite(trend.velocityRankPerDay);
  const status=upper(trend.status);
  const reasons=[];
  if(!clean(trend.historyKey))reasons.push('HISTORY_KEY_REQUIRED');
  if(sampleCount<2)reasons.push('COMPARABLE_HISTORY_REQUIRED');
  if(velocity===null)reasons.push('VELOCITY_REQUIRED');
  if(!['IMPROVING','DECLINING','FLAT'].includes(status))reasons.push('COMPARABLE_TREND_STATUS_REQUIRED');
  if(asOfMs===null)reasons.push('AS_OF_INVALID');
  if(lastObservedMs===null)reasons.push('LAST_OBSERVED_AT_REQUIRED');
  let ageMs=null;
  if(asOfMs!==null&&lastObservedMs!==null){
    ageMs=asOfMs-lastObservedMs;
    if(ageMs<0)reasons.push('TREND_OBSERVED_IN_FUTURE');
    if(ageMs>maxAgeMs)reasons.push('TREND_STALE');
  }
  if(Number(trend.verifiedSalesRows||0)!==0||upper(trend.salesEvidenceClass)!=='NOT_VERIFIED_SALES')reasons.push('TRUTH_CLASS_VIOLATION');
  const analysisEligible=reasons.length===0;
  return{
    schema:'MPR_RANKING_TREND_HANDOFF_ELIGIBILITY_V1',
    historyKey:clean(trend.historyKey)||null,
    analysisEligible,
    decision:analysisEligible?'ANALYSIS_ELIGIBLE':'HOLD',
    sampleCount,
    velocityRankPerDay:velocity,
    status:status||null,
    lastObservedAt:lastObservedMs===null?null:new Date(lastObservedMs).toISOString(),
    ageMs,
    maxAgeMs,
    reasons
  };
}

export function buildRankingTrendHandoff(cycle={},options={}){
  const asOf=clean(options.asOf)||clean(cycle.completedAt)||new Date().toISOString();
  const trends=Array.isArray(cycle?.trends?.trends)?cycle.trends.trends:[];
  const cycleCompleted=upper(cycle.decision)==='COMPLETED';
  const productionPersistenceVerified=cycle.productionPersistenceVerified===true;
  const analysisRecords=[];
  const heldRecords=[];
  for(const trend of trends){
    const eligibility=evaluateTrendHandoffEligibility(trend,{asOf,maxAgeMs:options.maxAgeMs});
    const record={
      historyKey:clean(trend.historyKey)||null,
      status:upper(trend.status)||null,
      sampleCount:Number(trend.sampleCount||0),
      firstObservedAt:trend.firstObservedAt||null,
      lastObservedAt:trend.lastObservedAt||null,
      firstRank:finite(trend.firstRank),
      lastRank:finite(trend.lastRank),
      velocityRankPerDay:finite(trend.velocityRankPerDay),
      accelerationRankPerDay2:finite(trend.accelerationRankPerDay2),
      confirmedAcceleration:trend.confirmedAcceleration===true,
      verifiedSalesRows:0,
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      eligibility
    };
    if(cycleCompleted&&eligibility.analysisEligible)analysisRecords.push(record);
    else heldRecords.push({...record,holdReasons:[...(cycleCompleted?[]:['HISTORY_CYCLE_NOT_COMPLETED']),...eligibility.reasons]});
  }
  const productionRecords=productionPersistenceVerified?analysisRecords:[];
  const manifest={
    schema:'MPR_RANKING_TREND_HANDOFF_V1',
    asOf,
    sourceCycleFingerprint:clean(cycle.fingerprint)||null,
    cycleDecision:upper(cycle.decision)||null,
    productionPersistenceVerified,
    totalTrendCount:trends.length,
    analysisEligibleCount:analysisRecords.length,
    productionEligibleCount:productionRecords.length,
    heldCount:heldRecords.length,
    confirmedAccelerationCount:analysisRecords.filter(x=>x.confirmedAcceleration).length,
    handoffStatus:productionRecords.length>0?'PRODUCTION_READY':analysisRecords.length>0?'ANALYSIS_ONLY':'NO_COMPARABLE_TRENDS',
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
  return{
    manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},
    analysisRecords,
    productionRecords,
    heldRecords
  };
}

export function evaluateScheduledRankingInput(input={},options={}){
  const now=clean(options.now)||new Date().toISOString();
  const nowMs=parseTime(now);
  const sourceGeneratedMs=parseTime(input.generatedAt||input?.rankingSignalResolution?.manifest?.asOf);
  const maxInputAgeMs=Math.max(1,Number(options.maxInputAgeMs||2*60*60*1000));
  const reasons=[];
  if(nowMs===null)reasons.push('NOW_INVALID');
  if(!input?.rankingSignalResolution?.manifest)reasons.push('RANKING_SIGNAL_RESOLUTION_REQUIRED');
  if(sourceGeneratedMs===null)reasons.push('SOURCE_GENERATED_AT_REQUIRED');
  let ageMs=null;
  if(nowMs!==null&&sourceGeneratedMs!==null){
    ageMs=nowMs-sourceGeneratedMs;
    if(ageMs<0)reasons.push('SOURCE_GENERATED_IN_FUTURE');
    if(ageMs>maxInputAgeMs)reasons.push('SCHEDULER_INPUT_STALE');
  }
  const runnable=reasons.length===0;
  return{
    schema:'MPR_SCHEDULED_RANKING_INPUT_V1',
    runnable,
    decision:runnable?'RUN':'WAIT',
    now:nowMs===null?null:new Date(nowMs).toISOString(),
    sourceGeneratedAt:sourceGeneratedMs===null?null:new Date(sourceGeneratedMs).toISOString(),
    ageMs,
    maxInputAgeMs,
    reasons
  };
}
