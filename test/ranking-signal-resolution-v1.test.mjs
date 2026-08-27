import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSignalFreshness,resolveRankingSignalBundle} from '../ranking-signal-resolution-v1.js';

function record(overrides={}){
  const observedAt=overrides.observedAt||'2026-08-27T10:00:00.000Z';
  const contentSha256=overrides.contentSha256||'a'.repeat(64);
  return{
    schema:'MPR_RANKING_SIGNAL_RECORD_V1',
    identityKey:'AMAZON:B00TEST001',
    marketplace:'AMAZON',
    externalId:'B00TEST001',
    evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',
    trustedEligible:true,
    observedAt,
    fingerprint:overrides.fingerprint||`${observedAt}:${contentSha256}`,
    provenance:{collector:'test',runId:'RUN1',contentSha256},
    envelope:{payload:{rank:overrides.rank??12}},
    ...overrides
  };
}

function bundle(records,heldRecords=[]){
  return{manifest:{fingerprint:'bundle-1'},trustedRecords:records,heldRecords};
}

test('fresh signal passes within age window',()=>{
  const x=evaluateSignalFreshness(record(),{asOf:'2026-08-27T11:00:00.000Z',maxAgeMs:2*60*60*1000});
  assert.equal(x.fresh,true);
  assert.equal(x.ageMs,60*60*1000);
});

test('stale and future signals fail closed',()=>{
  const stale=evaluateSignalFreshness(record(),{asOf:'2026-08-27T13:00:00.000Z',maxAgeMs:2*60*60*1000});
  assert.equal(stale.fresh,false);
  assert.ok(stale.reasons.includes('SIGNAL_STALE'));
  const future=evaluateSignalFreshness(record({observedAt:'2026-08-27T14:00:00.000Z'}),{asOf:'2026-08-27T13:00:00.000Z'});
  assert.equal(future.fresh,false);
  assert.ok(future.reasons.includes('OBSERVED_AT_IN_FUTURE'));
});

test('newest fresh signal supersedes older signal deterministically',()=>{
  const older=record({observedAt:'2026-08-27T09:00:00.000Z',fingerprint:'older',rank:20,contentSha256:'b'.repeat(64)});
  const newer=record({observedAt:'2026-08-27T10:00:00.000Z',fingerprint:'newer',rank:10,contentSha256:'c'.repeat(64)});
  const out=resolveRankingSignalBundle(bundle([older,newer]),{asOf:'2026-08-27T11:00:00.000Z'});
  assert.equal(out.trustedRecords.length,1);
  assert.equal(out.trustedRecords[0].fingerprint,'newer');
  assert.equal(out.manifest.supersededCount,1);
  assert.equal(out.heldRecords.some(x=>x.resolution?.reason==='SUPERSEDED_BY_NEWER_SIGNAL'),true);
});

test('different latest claims at same timestamp create conflict and no trusted output',()=>{
  const a=record({fingerprint:'a',rank:10,contentSha256:'d'.repeat(64)});
  const b=record({fingerprint:'b',rank:25,contentSha256:'e'.repeat(64)});
  const out=resolveRankingSignalBundle(bundle([a,b]),{asOf:'2026-08-27T11:00:00.000Z'});
  assert.equal(out.trustedRecords.length,0);
  assert.equal(out.manifest.conflictGroupCount,1);
  assert.equal(out.heldRecords.filter(x=>x.resolution?.reason==='LATEST_SIGNAL_CONFLICT').length,2);
});

test('duplicate latest claim resolves to one selected record',()=>{
  const a=record({fingerprint:'a'});
  const b=record({fingerprint:'b'});
  const out=resolveRankingSignalBundle(bundle([b,a]),{asOf:'2026-08-27T11:00:00.000Z'});
  assert.equal(out.trustedRecords.length,1);
  assert.equal(out.trustedRecords[0].fingerprint,'a');
  assert.equal(out.trustedRecords[0].resolution.duplicateLatestCount,2);
});

test('resolver preserves safety invariants',()=>{
  const out=resolveRankingSignalBundle(bundle([record()]),{asOf:'2026-08-27T11:00:00.000Z'});
  assert.equal(out.manifest.providerDataSpendEur,0);
  assert.equal(out.manifest.paidDataCallsTriggered,0);
  assert.equal(out.manifest.purchaseAuthorized,false);
  assert.equal(out.manifest.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.manifest.crossPlatformAutoMerge,false);
});
