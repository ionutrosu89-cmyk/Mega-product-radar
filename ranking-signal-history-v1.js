import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function parseTime(value){
  const ms=Date.parse(clean(value));
  return Number.isFinite(ms)?ms:null;
}

function explicitRankValue(record={}){
  const payload=record?.envelope?.payload||{};
  for(const candidate of [payload.explicitRank,payload.categoryRank,payload.bsr,payload.rank]){
    const value=finite(candidate);
    if(value!==null&&value>0)return value;
  }
  return null;
}

function categoryKey(record={}){
  const payload=record?.envelope?.payload||{};
  return clean(payload.rankCategory||payload.category||payload.categoryName||payload.browseNodeId)||null;
}

function historyIdentity(record={}){
  const identityKey=clean(record.identityKey);
  const evidenceClass=upper(record.evidenceClass);
  const category=categoryKey(record)||'UNSCOPED';
  return identityKey&&evidenceClass?`${identityKey}|${evidenceClass}|${category}`:null;
}

export function createHistoricalSignalEntry(record={}){
  const observedMs=parseTime(record.observedAt||record?.envelope?.source?.observedAt);
  const payload={
    schema:'MPR_RANKING_SIGNAL_HISTORY_ENTRY_V1',
    identityKey:clean(record.identityKey)||null,
    evidenceClass:upper(record.evidenceClass)||null,
    categoryKey:categoryKey(record),
    observedAt:observedMs===null?null:new Date(observedMs).toISOString(),
    rankValue:explicitRankValue(record),
    signalFingerprint:clean(record.fingerprint)||null,
    contentSha256:clean(record?.provenance?.contentSha256)||null,
    sourceName:clean(record.sourceName)||null,
    trustedEligible:record.trustedEligible===true,
    resolutionDecision:upper(record?.resolution?.decision)||null,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{...payload,historyKey:historyIdentity(record),fingerprint:deterministicFingerprint(payload)};
}

export function appendResolvedSignalsToLedger(existingLedger={},resolvedBundle={}){
  const existing=Array.isArray(existingLedger?.entries)?existingLedger.entries:[];
  const selected=Array.isArray(resolvedBundle?.trustedRecords)?resolvedBundle.trustedRecords:[];
  const bySignal=new Map();
  for(const entry of existing){
    const key=clean(entry?.signalFingerprint)||clean(entry?.fingerprint);
    if(key&&!bySignal.has(key))bySignal.set(key,entry);
  }
  let appendedCount=0;
  for(const record of selected){
    if(record?.trustedEligible!==true||upper(record?.resolution?.decision)!=='SELECTED')continue;
    const entry=createHistoricalSignalEntry(record);
    if(!entry.historyKey||!entry.observedAt||!entry.signalFingerprint)continue;
    if(bySignal.has(entry.signalFingerprint))continue;
    bySignal.set(entry.signalFingerprint,entry);
    appendedCount+=1;
  }
  const entries=[...bySignal.values()].sort((a,b)=>{
    const ka=clean(a.historyKey);const kb=clean(b.historyKey);
    if(ka!==kb)return ka.localeCompare(kb);
    const ta=parseTime(a.observedAt)||0;const tb=parseTime(b.observedAt)||0;
    if(ta!==tb)return ta-tb;
    return clean(a.fingerprint).localeCompare(clean(b.fingerprint));
  });
  const manifest={
    schema:'MPR_RANKING_SIGNAL_HISTORY_LEDGER_V1',
    entryCount:entries.length,
    appendedCount,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
  return{manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},entries};
}

export function deriveRankTrend(entries=[],options={}){
  const minIntervalMs=Math.max(1,Number(options.minIntervalMs||60*60*1000));
  const comparable=(Array.isArray(entries)?entries:[])
    .filter(x=>x?.historyKey&&finite(x?.rankValue)!==null&&parseTime(x?.observedAt)!==null)
    .sort((a,b)=>(parseTime(a.observedAt)||0)-(parseTime(b.observedAt)||0));
  const historyKey=comparable[0]?.historyKey||null;
  const sameHistory=historyKey?comparable.filter(x=>x.historyKey===historyKey):[];
  const deduped=[];
  for(const entry of sameHistory){
    const prior=deduped[deduped.length-1];
    if(prior&&parseTime(prior.observedAt)===parseTime(entry.observedAt))continue;
    deduped.push(entry);
  }
  const usable=[];
  for(const entry of deduped){
    if(!usable.length||parseTime(entry.observedAt)-parseTime(usable[usable.length-1].observedAt)>=minIntervalMs)usable.push(entry);
  }
  const base={
    schema:'MPR_RANK_TREND_V1',
    historyKey,
    sampleCount:usable.length,
    minIntervalMs,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  if(usable.length<2)return{...base,status:'INSUFFICIENT_COMPARABLE_HISTORY',velocityRankPerDay:null,accelerationRankPerDay2:null,confirmedAcceleration:false};
  const first=usable[0],last=usable[usable.length-1];
  const elapsedDays=(parseTime(last.observedAt)-parseTime(first.observedAt))/86400000;
  const velocityRankPerDay=elapsedDays>0?(Number(first.rankValue)-Number(last.rankValue))/elapsedDays:null;
  let accelerationRankPerDay2=null;
  let confirmedAcceleration=false;
  if(usable.length>=3){
    const a=usable[usable.length-3],b=usable[usable.length-2],c=usable[usable.length-1];
    const d1=(parseTime(b.observedAt)-parseTime(a.observedAt))/86400000;
    const d2=(parseTime(c.observedAt)-parseTime(b.observedAt))/86400000;
    if(d1>0&&d2>0){
      const v1=(Number(a.rankValue)-Number(b.rankValue))/d1;
      const v2=(Number(b.rankValue)-Number(c.rankValue))/d2;
      accelerationRankPerDay2=(v2-v1)/((d1+d2)/2);
      confirmedAcceleration=v1>0&&v2>v1&&accelerationRankPerDay2>0;
    }
  }
  const epsilon=Number(options.flatVelocityEpsilon||0.05);
  const status=velocityRankPerDay===null?'INSUFFICIENT_COMPARABLE_HISTORY':velocityRankPerDay>epsilon?'IMPROVING':velocityRankPerDay<-epsilon?'DECLINING':'FLAT';
  return{...base,status,firstObservedAt:first.observedAt,lastObservedAt:last.observedAt,firstRank:first.rankValue,lastRank:last.rankValue,velocityRankPerDay,accelerationRankPerDay2,confirmedAcceleration};
}

export function buildHistoricalTrendIndex(ledger={},options={}){
  const groups=new Map();
  for(const entry of Array.isArray(ledger?.entries)?ledger.entries:[]){
    if(!entry?.historyKey)continue;
    if(!groups.has(entry.historyKey))groups.set(entry.historyKey,[]);
    groups.get(entry.historyKey).push(entry);
  }
  const trends=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,entries])=>deriveRankTrend(entries,options));
  const confirmedAccelerationCount=trends.filter(x=>x.confirmedAcceleration).length;
  const manifest={
    schema:'MPR_RANK_TREND_INDEX_V1',
    historyGroupCount:trends.length,
    comparableTrendCount:trends.filter(x=>x.sampleCount>=2).length,
    confirmedAccelerationCount,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
  return{manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},trends};
}
