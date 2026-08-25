import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  extractTrendyolSnapshotsFromReviewedBatch,
  ingestTrendyolReviewedEvidence,
  buildRomaniaLocalEvidenceByNiche,
  validateRomaniaQueueAgainstUnifiedLedger
} from '../trendyol-romania-evidence-ingestion-v1.js';

const batch=JSON.parse(fs.readFileSync(new URL('../data/romania-public-market-evidence-batch-v1.json',import.meta.url),'utf8'));
const queue=JSON.parse(fs.readFileSync(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));

test('extracts reviewed Trendyol observations but downgrades contaminated counts to surface-only evidence',()=>{
  const rows=extractTrendyolSnapshotsFromReviewedBatch(batch);
  assert.equal(rows.length,3);
  assert.equal(rows[0].platform,'TRENDYOL');
  assert.equal(rows[0].comparabilityKey,'PACKING_CUBES_SET');
  assert.equal(rows[1].comparabilityKey,'CAR_TRUNK_ORGANIZERS');
  assert.equal(rows[2].comparabilityKey,'ADJUSTABLE_LAPTOP_STANDS');
  assert.equal(rows[0].listingCount,null);
  assert.equal(rows[0].listingCountLowerBound,null);
  assert.equal(rows[0].surfaceItemCountLowerBound,656);
  assert.equal(rows[0].comparableScopeConfirmed,false);
  assert.equal(rows[1].surfaceItemCountLowerBound,512);
  assert.equal(rows[2].surfaceItemCountLowerBound,1636);
});

test('ingestion is append-only and duplicate safe',()=>{
  const first=ingestTrendyolReviewedEvidence({ledger:{version:'1.3',observations:[]},batch});
  assert.equal(first.appended,3);
  assert.equal(first.ledger.observations.length,3);
  const second=ingestTrendyolReviewedEvidence({ledger:first.ledger,batch});
  assert.equal(second.appended,0);
  assert.equal(second.duplicates,3);
  assert.equal(second.ledger.observations.length,3);
  assert.equal(second.paidCallsTriggered,0);
  assert.equal(second.purchaseAuthorized,false);
});

test('both EMAG and TRENDYOL local evidence are derived from the same unified ledger',()=>{
  const item=queue.items.find(x=>x.nicheKey==='travel:packing-cubes');
  const ledger={version:'1.3',observations:[
    {nicheKey:item.nicheKey,platform:'EMAG',market:'RO',comparabilityKey:item.comparabilityKey,observedAt:'2026-08-25T10:00:00Z',sourceUrl:'https://example.test/emag',scope:'MARKET_WIDE',manualReviewed:true,comparableScopeConfirmed:true,listingCount:12},
    {nicheKey:item.nicheKey,platform:'TRENDYOL',market:'RO',comparabilityKey:item.comparabilityKey,observedAt:'2026-08-25T10:01:00Z',sourceUrl:'https://example.test/trendyol',scope:'MARKET_WIDE',manualReviewed:true,comparableScopeConfirmed:true,listingCount:15}
  ]};
  const evidence=buildRomaniaLocalEvidenceByNiche({ledger,queueItems:[item],emagEvidenceByNiche:{[item.nicheKey]:{listingCount:999}}});
  assert.equal(evidence[item.nicheKey].EMAG.listingCount,12);
  assert.equal(evidence[item.nicheKey].TRENDYOL.listingCount,15);
  const result=validateRomaniaQueueAgainstUnifiedLedger({ledger,queueItems:[item],emagEvidenceByNiche:{[item.nicheKey]:{listingCount:999}}});
  assert.equal(result.promotable,1);
  assert.equal(result.policy.includes('NO_SIDE_CHANNEL_EVIDENCE'),true);
});

test('contaminated Trendyol surfaces remain blocked in unified promotion validation',()=>{
  const ingested=ingestTrendyolReviewedEvidence({ledger:{version:'1.3',observations:[]},batch});
  const result=validateRomaniaQueueAgainstUnifiedLedger({ledger:ingested.ledger,queueItems:queue.items});
  assert.equal(result.total,3);
  assert.equal(result.promotable,0);
  const packing=result.rows.find(x=>x.nicheKey==='travel:packing-cubes');
  assert.ok(packing.blockers.includes('TRENDYOL_EXACT_COUNT_MISSING'));
  assert.ok(packing.blockers.includes('TRENDYOL_SCOPE_NOT_CONFIRMED'));
  assert.ok(packing.blockers.includes('EMAG_EXACT_COUNT_MISSING'));
});

test('no Trendyol reviewed evidence may claim verified sales or authorize purchase',()=>{
  const rows=extractTrendyolSnapshotsFromReviewedBatch(batch);
  assert.ok(rows.every(x=>x.salesEvidenceClass==='NOT_VERIFIED_SALES'));
  const ingested=ingestTrendyolReviewedEvidence({ledger:{version:'1.3',observations:[]},batch});
  assert.equal(ingested.approvedSpendEur,0);
  assert.equal(ingested.purchaseAuthorized,false);
});
