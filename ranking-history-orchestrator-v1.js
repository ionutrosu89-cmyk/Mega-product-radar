import {deterministicFingerprint} from './data-pipeline-core-v1.js';
import {appendResolvedSignalsToLedger,buildHistoricalTrendIndex} from './ranking-signal-history-v1.js';
import {persistRankingHistoryRecord,restoreRankingHistoryRecord} from './ranking-history-store-v1.js';

const clean=value=>String(value??'').trim();
const parseTime=value=>{const ms=Date.parse(clean(value));return Number.isFinite(ms)?ms:null;};

export function evaluateHistoryCycleDue(state={},options={}){
  const now=clean(options.now)||new Date().toISOString();
  const nowMs=parseTime(now);
  const intervalMs=Math.max(60000,Number(options.intervalMs||60*60*1000));
  const sourceFingerprint=clean(options.sourceFingerprint)||null;
  const priorSource=clean(state.lastSourceFingerprint)||null;
  const lastCompletedMs=parseTime(state.lastCompletedAt);
  const reasons=[];
  if(nowMs===null)reasons.push('NOW_INVALID');
  if(!sourceFingerprint)reasons.push('SOURCE_FINGERPRINT_REQUIRED');
  if(sourceFingerprint&&priorSource===sourceFingerprint)reasons.push('SOURCE_ALREADY_PROCESSED');
  if(nowMs!==null&&lastCompletedMs!==null&&nowMs-lastCompletedMs<intervalMs)reasons.push('INTERVAL_NOT_DUE');
  const due=reasons.length===0;
  return{
    schema:'MPR_RANKING_HISTORY_CYCLE_DUE_V1',
    due,
    decision:due?'RUN':'WAIT',
    now:nowMs===null?null:new Date(nowMs).toISOString(),
    intervalMs,
    sourceFingerprint,
    lastSourceFingerprint:priorSource,
    lastCompletedAt:lastCompletedMs===null?null:new Date(lastCompletedMs).toISOString(),
    reasons
  };
}

async function existingRecord(store,key,fallback){
  const envelope=await store.get(key);
  return envelope?.record??fallback;
}

export async function runRankingHistoryCycle(input={},options={}){
  const store=options.store;
  if(!store||typeof store.get!=='function'||typeof store.put!=='function')throw new Error('HISTORY_STORE_REQUIRED');
  const resolvedBundle=input.resolvedBundle;
  if(!resolvedBundle?.manifest)throw new Error('RESOLVED_RANKING_SIGNAL_BUNDLE_REQUIRED');
  const now=clean(options.now)||new Date().toISOString();
  const ledgerKey=clean(options.ledgerKey)||'ranking-signal-history-ledger';
  const trendKey=clean(options.trendKey)||'ranking-signal-trend-index';
  const stateKey=clean(options.stateKey)||'ranking-history-orchestration-state';
  const sourceFingerprint=clean(resolvedBundle?.manifest?.fingerprint)||deterministicFingerprint(resolvedBundle);
  const state=await existingRecord(store,stateKey,{});
  const due=evaluateHistoryCycleDue(state,{now,intervalMs:options.intervalMs,sourceFingerprint});
  if(!due.due)return{
    schema:'MPR_RANKING_HISTORY_CYCLE_V1',
    decision:'SKIPPED',
    due,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    productionPersistenceVerified:false
  };

  const existingLedger=await existingRecord(store,ledgerKey,{entries:[]});
  const ledger=appendResolvedSignalsToLedger(existingLedger,resolvedBundle);
  const trends=buildHistoricalTrendIndex(ledger,{minIntervalMs:options.minIntervalMs});
  const descriptorForKey=key=>typeof options.descriptorForKey==='function'?options.descriptorForKey(key):options.descriptor||{scope:store.scope};

  const ledgerReceipt=await persistRankingHistoryRecord(store,ledgerKey,ledger,{storedAt:now,descriptor:descriptorForKey(ledgerKey)});
  const trendReceipt=await persistRankingHistoryRecord(store,trendKey,trends,{storedAt:now,descriptor:descriptorForKey(trendKey)});
  const ledgerRestore=await restoreRankingHistoryRecord(store,ledgerReceipt,{descriptor:descriptorForKey(ledgerKey)});
  const trendRestore=await restoreRankingHistoryRecord(store,trendReceipt,{descriptor:descriptorForKey(trendKey)});

  const nextState={
    schema:'MPR_RANKING_HISTORY_ORCHESTRATION_STATE_V1',
    lastCompletedAt:now,
    lastSourceFingerprint:sourceFingerprint,
    ledgerFingerprint:ledger?.manifest?.fingerprint||null,
    trendFingerprint:trends?.manifest?.fingerprint||null
  };
  const stateReceipt=await persistRankingHistoryRecord(store,stateKey,nextState,{storedAt:now,descriptor:descriptorForKey(stateKey)});
  const stateRestore=await restoreRankingHistoryRecord(store,stateReceipt,{descriptor:descriptorForKey(stateKey)});
  const productionPersistenceVerified=ledgerRestore.productionVerified&&trendRestore.productionVerified&&stateRestore.productionVerified;

  const manifest={
    schema:'MPR_RANKING_HISTORY_CYCLE_V1',
    decision:'COMPLETED',
    completedAt:now,
    sourceFingerprint,
    appendedCount:Number(ledger?.manifest?.appendedCount||0),
    ledgerEntryCount:Number(ledger?.manifest?.entryCount||0),
    comparableTrendCount:Number(trends?.manifest?.comparableTrendCount||0),
    confirmedAccelerationCount:Number(trends?.manifest?.confirmedAccelerationCount||0),
    productionPersistenceVerified,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    crossPlatformAutoMerge:false
  };
  return{
    ...manifest,
    fingerprint:deterministicFingerprint(manifest),
    due,
    ledger,
    trends,
    receipts:{ledger:ledgerReceipt,trends:trendReceipt,state:stateReceipt},
    restoreProofs:{ledger:ledgerRestore,trends:trendRestore,state:stateRestore}
  };
}
