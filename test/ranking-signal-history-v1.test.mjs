import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoricalSignalEntry,appendResolvedSignalsToLedger,deriveRankTrend,buildHistoricalTrendIndex} from '../ranking-signal-history-v1.js';

function record({observedAt='2026-08-25T00:00:00.000Z',rank=100,fp='sig-1',category='Home',identityKey='AMAZON:B001'}={}){
  return{
    identityKey,
    evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',
    trustedEligible:true,
    fingerprint:fp,
    observedAt,
    sourceName:'TEST',
    provenance:{contentSha256:'a'.repeat(64)},
    resolution:{decision:'SELECTED'},
    envelope:{payload:{explicitRank:rank,rankCategory:category},source:{observedAt}}
  };
}

test('history entry keeps explicit rank and NOT_VERIFIED_SALES truth class',()=>{
  const entry=createHistoricalSignalEntry(record());
  assert.equal(entry.rankValue,100);
  assert.equal(entry.categoryKey,'Home');
  assert.equal(entry.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(entry.historyKey,'AMAZON:B001|EXPLICIT_PRODUCT_BEST_SELLERS_RANK|Home');
});

test('ledger append is idempotent by signal fingerprint',()=>{
  const bundle={trustedRecords:[record()]};
  const first=appendResolvedSignalsToLedger({},bundle);
  const second=appendResolvedSignalsToLedger(first,bundle);
  assert.equal(first.entries.length,1);
  assert.equal(second.entries.length,1);
  assert.equal(second.manifest.appendedCount,0);
});

test('non-selected or untrusted signals cannot enter historical ledger',()=>{
  const a=record({fp:'a'});a.resolution.decision='HOLD';
  const b=record({fp:'b'});b.trustedEligible=false;
  const ledger=appendResolvedSignalsToLedger({}, {trustedRecords:[a,b]});
  assert.equal(ledger.entries.length,0);
});

test('trend requires at least two comparable spaced observations',()=>{
  const one=createHistoricalSignalEntry(record());
  assert.equal(deriveRankTrend([one],{minIntervalMs:1}).status,'INSUFFICIENT_COMPARABLE_HISTORY');
  const close=createHistoricalSignalEntry(record({observedAt:'2026-08-25T00:30:00.000Z',rank:90,fp:'sig-2'}));
  assert.equal(deriveRankTrend([one,close],{minIntervalMs:60*60*1000}).sampleCount,1);
});

test('lower rank over time is improving and higher rank is declining',()=>{
  const a=createHistoricalSignalEntry(record({observedAt:'2026-08-24T00:00:00.000Z',rank:100,fp:'a'}));
  const b=createHistoricalSignalEntry(record({observedAt:'2026-08-25T00:00:00.000Z',rank:80,fp:'b'}));
  const improving=deriveRankTrend([a,b],{minIntervalMs:1});
  assert.equal(improving.status,'IMPROVING');
  assert.ok(improving.velocityRankPerDay>0);
  const declining=deriveRankTrend([b,{...a,observedAt:'2026-08-26T00:00:00.000Z',rankValue:120,fingerprint:'c',signalFingerprint:'c'}],{minIntervalMs:1});
  assert.equal(declining.status,'DECLINING');
});

test('confirmed acceleration requires three increasingly improving comparable samples',()=>{
  const entries=[
    createHistoricalSignalEntry(record({observedAt:'2026-08-24T00:00:00.000Z',rank:100,fp:'a'})),
    createHistoricalSignalEntry(record({observedAt:'2026-08-25T00:00:00.000Z',rank:90,fp:'b'})),
    createHistoricalSignalEntry(record({observedAt:'2026-08-26T00:00:00.000Z',rank:60,fp:'c'}))
  ];
  const trend=deriveRankTrend(entries,{minIntervalMs:1});
  assert.equal(trend.confirmedAcceleration,true);
  assert.ok(trend.accelerationRankPerDay2>0);
  assert.equal(trend.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('different category histories never fuse into one trend',()=>{
  const a=createHistoricalSignalEntry(record({category:'Home',fp:'a'}));
  const b=createHistoricalSignalEntry(record({category:'Kitchen',observedAt:'2026-08-26T00:00:00.000Z',rank:50,fp:'b'}));
  const index=buildHistoricalTrendIndex({entries:[a,b]},{minIntervalMs:1});
  assert.equal(index.manifest.historyGroupCount,2);
  assert.equal(index.manifest.comparableTrendCount,0);
  assert.equal(index.manifest.purchaseAuthorized,false);
  assert.equal(index.manifest.paidDataCallsTriggered,0);
});
