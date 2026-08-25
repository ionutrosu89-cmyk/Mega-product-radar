import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildRomaniaEvidencePromotionReport,buildRomaniaPromotionReportFromLedger} from '../romania-evidence-promotion-report-v1.js';
import {ingestTrendyolReviewedEvidence} from '../trendyol-romania-evidence-ingestion-v1.js';

const queue=JSON.parse(await fs.readFile(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));
const batch=JSON.parse(await fs.readFile(new URL('../data/romania-public-market-evidence-batch-v1.json',import.meta.url),'utf8'));
const queueItems=queue.items||queue.queue||queue.niches||[];
const packing=queueItems.find(x=>x.nicheKey==='travel:packing-cubes');

const exactRow=(platform,observedAt,listingCount,extra={})=>({
  nicheKey:packing.nicheKey,
  platform,
  market:'RO',
  comparabilityKey:packing.comparabilityKey,
  observedAt,
  sourceUrl:`https://example.test/${platform.toLowerCase()}/${observedAt}`,
  scope:'MARKET_WIDE',
  evidenceType:'PUBLIC_MARKET_SIGNAL',
  manualReviewed:true,
  comparableScopeConfirmed:true,
  listingCount,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  ...extra
});

test('promotion report fails closed when canonical ledger lacks platform evidence',()=>{
  const r=buildRomaniaPromotionReportFromLedger({queueItems,ledger:{version:'1.3',observations:[]}});
  assert.equal(r.total,3);
  assert.equal(r.promotable,0);
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.approvedSpendEur,0);
  assert.equal(r.purchaseAuthorized,false);
  assert.ok(r.rows.every(x=>x.status==='BLOCKED'));
  assert.ok(r.rows.every(x=>x.blockers.includes('EMAG_LEDGER_OBSERVATION_MISSING')));
  assert.ok(r.rows.every(x=>x.blockers.includes('TRENDYOL_LEDGER_OBSERVATION_MISSING')));
});

test('known Trendyol broad counts remain surface-only after ingestion into canonical ledger',()=>{
  const ingested=ingestTrendyolReviewedEvidence({ledger:{version:'1.3',observations:[]},batch});
  const r=buildRomaniaPromotionReportFromLedger({queueItems,ledger:ingested.ledger});
  const packingRow=r.rows.find(x=>x.nicheKey==='travel:packing-cubes');
  const trunk=r.rows.find(x=>x.nicheKey==='automotive:trunk-organization');
  assert.equal(r.promotable,0);
  assert.equal(packingRow.evidence.TRENDYOL.listingCount,null);
  assert.equal(packingRow.evidence.TRENDYOL.surfaceItemCountLowerBound,656);
  assert.equal(packingRow.evidence.TRENDYOL.comparableScopeConfirmed,false);
  assert.ok(packingRow.blockers.includes('TRENDYOL_EXACT_COUNT_MISSING'));
  assert.ok(packingRow.blockers.includes('TRENDYOL_SCOPE_NOT_CONFIRMED'));
  assert.equal(trunk.evidence.TRENDYOL.surfaceItemCountLowerBound,512);
});

test('exact reviewed canonical eMAG and Trendyol ledger rows can promote',()=>{
  const ledger={version:'1.3',observations:[
    exactRow('EMAG','2026-08-25T10:00:00Z',12),
    exactRow('TRENDYOL','2026-08-25T10:05:00Z',15)
  ]};
  const r=buildRomaniaPromotionReportFromLedger({queueItems:[packing],ledger});
  assert.equal(r.promotable,1);
  assert.equal(r.rows[0].status,'PROMOTABLE');
  assert.deepEqual(r.rows[0].exactCompetition,{EMAG:12,TRENDYOL:15});
  assert.equal(r.rows[0].evidenceSource,'CANONICAL_ROMANIA_MARKET_SNAPSHOT_LEDGER');
});

test('canonical aliases group together and latest platform snapshot wins',()=>{
  const ledger={version:'1.3',observations:[
    exactRow('EMAG','2026-08-25T09:00:00Z',999,{comparabilityKey:'TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS'}),
    exactRow('EMAG','2026-08-25T11:00:00Z',11),
    exactRow('TRENDYOL','2026-08-25T11:01:00Z',14)
  ]};
  const r=buildRomaniaPromotionReportFromLedger({queueItems:[packing],ledger});
  assert.equal(r.promotable,1);
  assert.equal(r.rows[0].evidence.EMAG.listingCount,11);
  assert.equal(r.rows[0].comparabilityKey,'PACKING_CUBES_SET');
});

test('side-channel eMAG artifact argument cannot bypass ledger-only promotion',()=>{
  const ledger={version:'1.3',observations:[exactRow('TRENDYOL','2026-08-25T11:01:00Z',14)]};
  const fakeArtifact={observations:[exactRow('EMAG','2026-08-25T11:00:00Z',1)]};
  const r=buildRomaniaEvidencePromotionReport({queueItems:[packing],ledger,emagArtifact:fakeArtifact});
  assert.equal(r.promotable,0);
  assert.equal(r.rows[0].evidence.EMAG.observedAt,undefined);
  assert.ok(r.rows[0].blockers.includes('EMAG_LEDGER_OBSERVATION_MISSING'));
});

test('seller-scoped or store-scoped latest evidence remains blocked after ledger normalization',()=>{
  const ledger={version:'1.3',observations:[
    exactRow('EMAG','2026-08-25T11:00:00Z',11,{sellerScoped:true}),
    exactRow('TRENDYOL','2026-08-25T11:01:00Z',14)
  ]};
  const r=buildRomaniaPromotionReportFromLedger({queueItems:[packing],ledger});
  assert.equal(r.promotable,0);
  assert.equal(r.rows[0].evidence.EMAG.sellerScoped,true);
  assert.ok(r.rows[0].blockers.includes('EMAG_SCOPED_DATA_REJECTED'));
});

test('report never contains network execution, verified sales claim, or purchase authority',async()=>{
  const js=await fs.readFile(new URL('../romania-evidence-promotion-report-v1.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  const r=buildRomaniaPromotionReportFromLedger({queueItems,ledger:{observations:[]}});
  assert.equal(r.policy.includes('LEDGER_ONLY_PROMOTION_INPUT'),true);
  assert.equal(r.policy.includes('NO_SIDE_CHANNEL_EVIDENCE'),true);
  assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(r.purchaseAuthorized,false);
  assert.ok(r.rows.every(x=>x.purchaseAuthorized===false));
});
