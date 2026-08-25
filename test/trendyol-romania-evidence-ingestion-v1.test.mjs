import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  extractTrendyolSnapshotsFromReviewedBatch,
  ingestTrendyolReviewedEvidence,
  validateRomaniaQueueAgainstUnifiedLedger
} from '../trendyol-romania-evidence-ingestion-v1.js';

const batch=JSON.parse(fs.readFileSync(new URL('../data/romania-public-market-evidence-batch-v1.json',import.meta.url),'utf8'));
const queue=JSON.parse(fs.readFileSync(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));

test('extracts only reviewed Trendyol public-market observations with canonical keys',()=>{
  const rows=extractTrendyolSnapshotsFromReviewedBatch(batch);
  assert.equal(rows.length,3);
  assert.equal(rows[0].platform,'TRENDYOL');
  assert.equal(rows[0].comparabilityKey,'PACKING_CUBES_SET');
  assert.equal(rows[1].comparabilityKey,'CAR_TRUNK_ORGANIZERS');
  assert.equal(rows[2].comparabilityKey,'ADJUSTABLE_LAPTOP_STANDS');
  assert.equal(rows[0].listingCount,null);
  assert.equal(rows[0].listingCountLowerBound,656);
});

test('ingestion is append-only and duplicate safe',()=>{
  const first=ingestTrendyolReviewedEvidence({ledger:{version:'1.0',observations:[]},batch});
  assert.equal(first.appended,3);
  assert.equal(first.ledger.observations.length,3);
  const second=ingestTrendyolReviewedEvidence({ledger:first.ledger,batch});
  assert.equal(second.appended,0);
  assert.equal(second.duplicates,3);
  assert.equal(second.ledger.observations.length,3);
  assert.equal(second.paidCallsTriggered,0);
  assert.equal(second.purchaseAuthorized,false);
});

test('known Trendyol lower bounds remain blocked in unified promotion validation',()=>{
  const ingested=ingestTrendyolReviewedEvidence({ledger:{version:'1.0',observations:[]},batch});
  const result=validateRomaniaQueueAgainstUnifiedLedger({ledger:ingested.ledger,queueItems:queue.items,emagEvidenceByNiche:{}});
  assert.equal(result.total,3);
  assert.equal(result.promotable,0);
  const packing=result.rows.find(x=>x.nicheKey==='travel:packing-cubes');
  assert.ok(packing.blockers.includes('TRENDYOL_LOWER_BOUND_NOT_EXACT'));
  assert.ok(packing.blockers.includes('EMAG_EXACT_COUNT_MISSING'));
});

test('no Trendyol reviewed evidence may claim verified sales or authorize purchase',()=>{
  const rows=extractTrendyolSnapshotsFromReviewedBatch(batch);
  assert.ok(rows.every(x=>x.salesEvidenceClass==='NOT_VERIFIED_SALES'));
  const ingested=ingestTrendyolReviewedEvidence({ledger:{version:'1.0',observations:[]},batch});
  assert.equal(ingested.approvedSpendEur,0);
  assert.equal(ingested.purchaseAuthorized,false);
});
