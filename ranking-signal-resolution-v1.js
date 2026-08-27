import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const DEFAULT_MAX_AGE_MS=7*24*60*60*1000;

function parseTime(value){
  const ms=Date.parse(clean(value));
  return Number.isFinite(ms)?ms:null;
}

function claimFingerprint(record={}){
  return deterministicFingerprint({
    identityKey:record.identityKey||null,
    evidenceClass:upper(record.evidenceClass)||null,
    observedAt:clean(record.observedAt)||null,
    contentSha256:clean(record?.provenance?.contentSha256)||null,
    payload:record?.envelope?.payload??null
  });
}

export function evaluateSignalFreshness(record={},options={}){
  const asOfMs=parseTime(options.asOf||new Date().toISOString());
  const observedMs=parseTime(record.observedAt||record?.envelope?.source?.observedAt);
  const maxAgeMs=Math.max(1,Number(options.maxAgeMs||DEFAULT_MAX_AGE_MS));
  const reasons=[];
  let ageMs=null;
  if(asOfMs===null)reasons.push('AS_OF_INVALID');
  if(observedMs===null)reasons.push('OBSERVED_AT_REQUIRED');
  if(asOfMs!==null&&observedMs!==null){
    ageMs=asOfMs-observedMs;
    if(ageMs<0)reasons.push('OBSERVED_AT_IN_FUTURE');
    if(ageMs>maxAgeMs)reasons.push('SIGNAL_STALE');
  }
  const fresh=reasons.length===0;
  return{
    schema:'MPR_RANKING_SIGNAL_FRESHNESS_V1',
    fresh,
    decision:fresh?'FRESH':'FRESHNESS_HOLD',
    observedAt:observedMs===null?null:new Date(observedMs).toISOString(),
    asOf:asOfMs===null?null:new Date(asOfMs).toISOString(),
    ageMs,
    maxAgeMs,
    reasons
  };
}

function resolutionHold(record,reason,details={}){
  return{
    ...record,
    resolution:{
      schema:'MPR_RANKING_SIGNAL_RESOLUTION_HOLD_V1',
      decision:'HOLD',
      reason,
      ...details
    }
  };
}

export function resolveRankingSignalBundle(bundle={},options={}){
  const trustedInput=Array.isArray(bundle?.trustedRecords)?bundle.trustedRecords:[];
  const originalHeld=Array.isArray(bundle?.heldRecords)?bundle.heldRecords:[];
  const asOf=clean(options.asOf)||new Date().toISOString();
  const maxAgeMs=Math.max(1,Number(options.maxAgeMs||DEFAULT_MAX_AGE_MS));
  const candidateGroups=new Map();
  const held=[...originalHeld];

  for(const record of trustedInput){
    const freshness=evaluateSignalFreshness(record,{asOf,maxAgeMs});
    if(!record?.trustedEligible||!record?.identityKey){
      held.push(resolutionHold(record,'TRUST_OR_IDENTITY_REQUIRED',{freshness}));
      continue;
    }
    if(!freshness.fresh){
      held.push(resolutionHold(record,'FRESHNESS_HOLD',{freshness}));
      continue;
    }
    const key=`${record.identityKey}|${upper(record.evidenceClass)}`;
    if(!candidateGroups.has(key))candidateGroups.set(key,[]);
    candidateGroups.get(key).push({...record,freshness,claimFingerprint:claimFingerprint(record)});
  }

  const resolved=[];
  let conflictGroupCount=0;
  let supersededCount=0;
  for(const [groupKey,records] of [...candidateGroups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    const ordered=[...records].sort((a,b)=>{
      const ta=parseTime(a.observedAt)||0;
      const tb=parseTime(b.observedAt)||0;
      if(tb!==ta)return tb-ta;
      return clean(a.fingerprint).localeCompare(clean(b.fingerprint));
    });
    const latestMs=parseTime(ordered[0]?.observedAt);
    const latest=ordered.filter(x=>parseTime(x.observedAt)===latestMs);
    const distinctClaims=new Set(latest.map(x=>x.claimFingerprint));
    if(distinctClaims.size>1){
      conflictGroupCount+=1;
      for(const record of latest)held.push(resolutionHold(record,'LATEST_SIGNAL_CONFLICT',{groupKey,conflictingClaimCount:distinctClaims.size}));
      for(const record of ordered.slice(latest.length)){
        supersededCount+=1;
        held.push(resolutionHold(record,'SUPERSEDED_BY_NEWER_SIGNAL',{groupKey}));
      }
      continue;
    }
    const selected=latest[0];
    resolved.push({
      ...selected,
      resolution:{
        schema:'MPR_RANKING_SIGNAL_RESOLUTION_V1',
        decision:'SELECTED',
        groupKey,
        selectedObservedAt:selected.observedAt,
        duplicateLatestCount:latest.length
      }
    });
    for(const record of ordered.slice(1)){
      supersededCount+=1;
      held.push(resolutionHold(record,'SUPERSEDED_BY_NEWER_SIGNAL',{groupKey,selectedFingerprint:selected.fingerprint}));
    }
  }

  const manifest={
    schema:'MPR_RANKING_SIGNAL_RESOLVED_BUNDLE_V1',
    sourceBundleFingerprint:clean(bundle?.manifest?.fingerprint)||null,
    asOf,
    maxAgeMs,
    trustedInputCount:trustedInput.length,
    resolvedTrustedCount:resolved.length,
    heldCount:held.length,
    conflictGroupCount,
    supersededCount,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
  return{
    manifest:{...manifest,fingerprint:deterministicFingerprint(manifest)},
    trustedRecords:resolved,
    heldRecords:held
  };
}
