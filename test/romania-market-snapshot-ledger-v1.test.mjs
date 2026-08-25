import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeRomaniaMarketSnapshot,appendRomaniaMarketSnapshot,buildRomaniaMarketSnapshotHistory,latestRomaniaMarketSnapshots} from '../romania-market-snapshot-ledger-v1.js';

const base={nicheKey:'travel:packing-cubes',platform:'TRENDYOL',market:'RO',comparabilityKey:'PACKING_CUBES_SET',sourceUrl:'https://www.trendyol.com/ro/example',scope:'MARKET_WIDE',evidenceType:'PUBLIC_MARKET_SIGNAL',manualReviewed:true,comparableScopeConfirmed:true,salesEvidenceClass:'VERIFIED'};

test('normalization forces safety semantics and requires provenance',()=>{
  const x=normalizeRomaniaMarketSnapshot({...base,observedAt:'2026-08-25T05:00:00Z',listingCountLowerBound:656});
  assert.equal(x.valid,true);
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(x.purchaseAuthorized,false);
  assert.equal(x.listingCount,null);
  assert.equal(x.listingCountLowerBound,656);
  const bad=normalizeRomaniaMarketSnapshot({...base,observedAt:null});
  assert.equal(bad.valid,false);
});

test('seller/store scoped safety flags survive normalization and history views',()=>{
  const x=normalizeRomaniaMarketSnapshot({...base,observedAt:'2026-08-25T05:00:00Z',listingCount:10,sellerScoped:true,storeScoped:true});
  assert.equal(x.sellerScoped,true);
  assert.equal(x.storeScoped,true);
  const history=buildRomaniaMarketSnapshotHistory({observations:[x]});
  assert.equal(history.histories[0].sellerScoped,true);
  assert.equal(history.histories[0].storeScoped,true);
  const latest=latestRomaniaMarketSnapshots({observations:[x]});
  assert.equal(latest[0].sellerScoped,true);
  assert.equal(latest[0].storeScoped,true);
});

test('ledger is append-only and exact duplicate is skipped',()=>{
  let ledger={version:'1.0',observations:[]};
  const row={...base,observedAt:'2026-08-25T05:00:00Z',listingCountLowerBound:656};
  ledger=appendRomaniaMarketSnapshot(ledger,row);
  assert.equal(ledger.append.status,'APPENDED');
  assert.equal(ledger.observations.length,1);
  const again=appendRomaniaMarketSnapshot(ledger,row);
  assert.equal(again.append.status,'DUPLICATE_SKIPPED');
  assert.equal(again.observations.length,1);
});

test('new observation never overwrites previous observation',()=>{
  let ledger={observations:[]};
  ledger=appendRomaniaMarketSnapshot(ledger,{...base,observedAt:'2026-08-25T05:00:00Z',listingCount:120});
  ledger=appendRomaniaMarketSnapshot(ledger,{...base,observedAt:'2026-08-26T05:00:00Z',listingCount:135});
  assert.equal(ledger.observations.length,2);
  const history=buildRomaniaMarketSnapshotHistory(ledger);
  assert.equal(history.histories[0].observations,2);
  assert.equal(history.histories[0].exactCountDelta,15);
});

test('lower-bound sequence does not create exact count delta',()=>{
  let ledger={observations:[]};
  ledger=appendRomaniaMarketSnapshot(ledger,{...base,observedAt:'2026-08-25T05:00:00Z',listingCountLowerBound:656});
  ledger=appendRomaniaMarketSnapshot(ledger,{...base,observedAt:'2026-08-26T05:00:00Z',listingCountLowerBound:670});
  const history=buildRomaniaMarketSnapshotHistory(ledger);
  assert.equal(history.histories[0].exactCountDelta,null);
  assert.match(history.policy,/NO_TREND_CLAIM_FROM_SINGLE_OBSERVATION/);
});

test('latest view is derived without deleting history',()=>{
  let ledger={observations:[]};
  ledger=appendRomaniaMarketSnapshot(ledger,{...base,observedAt:'2026-08-25T05:00:00Z',listingCount:100});
  ledger=appendRomaniaMarketSnapshot(ledger,{...base,observedAt:'2026-08-26T05:00:00Z',listingCount:110});
  const latest=latestRomaniaMarketSnapshots(ledger);
  assert.equal(latest.length,1);
  assert.equal(latest[0].listingCount,110);
  assert.equal(ledger.observations.length,2);
});
