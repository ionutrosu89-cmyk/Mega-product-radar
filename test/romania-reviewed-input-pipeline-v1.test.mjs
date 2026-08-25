import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {ingestReviewedRomaniaRows,runRomaniaReviewedEvidencePipeline} from '../romania-reviewed-input-pipeline-v1.js';

const queue=JSON.parse(await fs.readFile(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));
const batch=JSON.parse(await fs.readFile(new URL('../data/romania-public-market-evidence-batch-v1.json',import.meta.url),'utf8'));
const queueItems=queue.items||[];

const packingEmag={
  nicheKey:'travel:packing-cubes',platform:'EMAG',comparabilityKey:'PACKING_CUBES_SET',
  observedAt:'2026-08-25T11:00:00Z',sourceUrl:'https://www.emag.ro/search/organizator-valiza-set',
  scope:'MARKET_WIDE',listingCount:700,listingCountLowerBound:null,
  manualReviewed:true,comparableScopeConfirmed:true
};
const packingTrendyol={
  nicheKey:'travel:packing-cubes',platform:'TRENDYOL',comparabilityKey:'TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS',
  observedAt:'2026-08-25T11:05:00Z',sourceUrl:'https://www.trendyol.com/ro/organizatoare-pentru-valiza-x-c163720',
  scope:'MARKET_WIDE',listingCount:700,listingCountLowerBound:656,
  manualReviewed:true,comparableScopeConfirmed:true
};

test('two exact manually reviewed local observations can promote one canonical niche',()=>{
  const r=runRomaniaReviewedEvidencePipeline({queueItems:[queueItems[0]],reviewedBatch:batch,manualRows:[packingEmag,packingTrendyol]});
  assert.equal(r.ingestion.appended,2);
  assert.equal(r.ingestion.rejected,0);
  assert.equal(r.report.promotable,1);
  assert.equal(r.report.rows[0].status,'PROMOTABLE');
  assert.equal(r.report.rows[0].promotable,true);
  assert.deepEqual(r.promotableNiches,['travel:packing-cubes']);
  assert.equal(r.report.rows[0].evidence.EMAG.listingCount,700);
  assert.equal(r.report.rows[0].evidence.TRENDYOL.listingCount,700);
  assert.equal(r.report.rows[0].evidence.TRENDYOL.comparabilityKey,'PACKING_CUBES_SET');
  assert.equal(r.report.rows[0].evidenceSource,'CANONICAL_ROMANIA_MARKET_SNAPSHOT_LEDGER');
  assert.equal(r.purchaseAuthorized,false);
});

test('reviewed eMAG ledger evidence removes missing-ledger blocker but cannot promote alone',()=>{
  const r=runRomaniaReviewedEvidencePipeline({queueItems:[queueItems[0]],reviewedBatch:batch,manualRows:[packingEmag]});
  assert.equal(r.report.promotable,0);
  assert.equal(r.report.rows[0].blockers.includes('EMAG_LEDGER_OBSERVATION_MISSING'),false);
  assert.equal(r.report.rows[0].blockers.includes('TRENDYOL_LEDGER_OBSERVATION_MISSING'),true);
  assert.equal(r.report.rows[0].evidence.EMAG.listingCount,700);
});

test('invalid third-party or unreviewed rows are rejected before ledger append',()=>{
  const bad={...packingEmag,sourceUrl:'https://example.com/emag-index',manualReviewed:false};
  const r=ingestReviewedRomaniaRows({rows:[bad]});
  assert.equal(r.appended,0);
  assert.equal(r.rejected,1);
  assert.equal(r.ledger.observations?.length||0,0);
  assert.ok(r.results[0].blockers.includes('DIRECT_MARKETPLACE_SOURCE_REQUIRED'));
  assert.ok(r.results[0].blockers.includes('MANUAL_REVIEW_REQUIRED'));
});

test('exact Trendyol count below known lower bound stays invalid',()=>{
  const bad={...packingTrendyol,listingCount:600};
  const r=ingestReviewedRomaniaRows({rows:[bad]});
  assert.equal(r.appended,0);
  assert.equal(r.rejected,1);
  assert.ok(r.results[0].blockers.includes('EXACT_COUNT_BELOW_OBSERVED_LOWER_BOUND'));
});

test('reviewed ingestion is duplicate safe and zero-spend',()=>{
  const first=ingestReviewedRomaniaRows({rows:[packingEmag]});
  const second=ingestReviewedRomaniaRows({rows:[packingEmag],existingLedger:first.ledger});
  assert.equal(first.appended,1);
  assert.equal(second.appended,0);
  assert.equal(second.duplicates,1);
  assert.equal(second.paidCallsTriggered,0);
  assert.equal(second.approvedSpendEur,0);
  assert.equal(second.purchaseAuthorized,false);
});

test('pipeline contains no network execution and never claims verified sales',async()=>{
  const js=await fs.readFile(new URL('../romania-reviewed-input-pipeline-v1.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  const r=runRomaniaReviewedEvidencePipeline({queueItems,reviewedBatch:batch,manualRows:[]});
  assert.equal(r.policy.includes('NO_SIDE_CHANNEL_EVIDENCE'),true);
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(r.purchaseAuthorized,false);
});
