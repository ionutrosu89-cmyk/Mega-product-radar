import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildRomaniaEvidencePromotionReport} from '../romania-evidence-promotion-report-v1.js';

const queue=JSON.parse(await fs.readFile(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));
const batch=JSON.parse(await fs.readFile(new URL('../data/romania-public-market-evidence-batch-v1.json',import.meta.url),'utf8'));
const queueItems=queue.items||queue.queue||queue.niches||[];

test('current Romania evidence report fails closed without eMAG artifact',()=>{
  const r=buildRomaniaEvidencePromotionReport({queueItems,reviewedBatch:batch,emagArtifact:null});
  assert.equal(r.total,3);
  assert.equal(r.promotable,0);
  assert.equal(r.emagArtifactPresent,false);
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.approvedSpendEur,0);
  assert.equal(r.purchaseAuthorized,false);
  assert.ok(r.rows.every(x=>x.status==='BLOCKED'));
  assert.ok(r.rows.every(x=>x.blockers.includes('EMAG_PROBE_ARTIFACT_MISSING')));
});

test('known Trendyol lower bounds remain non-exact in report',()=>{
  const r=buildRomaniaEvidencePromotionReport({queueItems,reviewedBatch:batch});
  const packing=r.rows.find(x=>x.nicheKey==='travel:packing-cubes');
  const trunk=r.rows.find(x=>x.nicheKey==='automotive:trunk-organization');
  assert.ok(packing);
  assert.ok(trunk);
  assert.equal(packing.evidence.TRENDYOL.listingCount,null);
  assert.ok(Number(packing.evidence.TRENDYOL.listingCountLowerBound)>0);
  assert.ok(packing.blockers.includes('TRENDYOL_EXACT_COUNT_MISSING'));
  assert.equal(trunk.evidence.TRENDYOL.listingCount,null);
  assert.ok(trunk.blockers.includes('TRENDYOL_EXACT_COUNT_MISSING'));
});

test('usable eMAG lower-bound artifact becomes review input but cannot promote',()=>{
  const item=queueItems.find(x=>x.nicheKey==='travel:packing-cubes');
  const artifact={observations:[{
    nicheKey:item.nicheKey,
    comparabilityKey:item.comparabilityKey,
    observedAt:'2026-08-25T10:00:00Z',
    sourceUrl:'https://www.emag.ro/search/organizator%20valiza%20set',
    usable:true,blocked:false,statusCode:200,productLinkLowerBound:24,
    declaredResultCountCandidate:1000
  }]};
  const r=buildRomaniaEvidencePromotionReport({queueItems:[item],reviewedBatch:batch,emagArtifact:artifact});
  assert.equal(r.emagArtifactPresent,true);
  assert.equal(r.promotable,0);
  assert.equal(r.rows[0].evidence.EMAG.listingCount,null);
  assert.equal(r.rows[0].evidence.EMAG.listingCountLowerBound,24);
  assert.ok(r.rows[0].blockers.includes('EMAG_EXACT_COUNT_MISSING'));
  assert.ok(r.rows[0].blockers.includes('EMAG_LOWER_BOUND_NOT_EXACT'));
  assert.equal(r.rows[0].evidence.EMAG.provenance.declaredResultCountTrusted,false);
});

test('report never contains network execution or purchase authority',async()=>{
  const js=await fs.readFile(new URL('../romania-evidence-promotion-report-v1.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  const r=buildRomaniaEvidencePromotionReport({queueItems,reviewedBatch:batch});
  assert.equal(r.policy.includes('NO_NETWORK'),true);
  assert.equal(r.purchaseAuthorized,false);
  assert.ok(r.rows.every(x=>x.purchaseAuthorized===false));
});
