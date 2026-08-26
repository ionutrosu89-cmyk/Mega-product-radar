import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {extractAmazonBestSellerRanks,buildComparableBsrHistory} from '../amazon-product-bsr-evidence-v1.js';

const asin='B00INKVS82';
const html=`<html><body>${asin}<div>Best Sellers Rank</div><span>#1,234 in Office Products (See Top 100 in Office Products)</span><span>#17 in View Binders</span><div>Date First Available</div></body></html>`;

test('extracts every explicit BSR category rank without choosing an arbitrary primary rank',()=>{
  const r=extractAmazonBestSellerRanks(html,{asin});
  assert.equal(r.ok,true);
  assert.equal(r.status,'EXPLICIT_BSR_EVIDENCE_CAPTURED');
  assert.equal(r.rankEvidenceCount,2);
  assert.deepEqual(r.entries.map(x=>[x.rank,x.category]),[[1234,'Office Products'],[17,'View Binders']]);
  assert.equal(r.sourceRank,null);
  assert.ok(r.entries.every(x=>x.salesEvidenceClass==='NOT_VERIFIED_SALES'));
});

test('HTML order without Best Sellers Rank marker never becomes rank evidence',()=>{
  const r=extractAmazonBestSellerRanks(`<html>${asin}<div>#1 in Office Products</div></html>`,{asin});
  assert.equal(r.rankEvidenceCount,0);
  assert.equal(r.status,'BSR_BLOCK_NOT_OBSERVED');
});

test('identity mismatch and robot pages fail closed',()=>{
  assert.equal(extractAmazonBestSellerRanks('<html>Best Sellers Rank #1 in Office Products</html>',{asin}).status,'IDENTITY_NOT_CONFIRMED');
  assert.equal(extractAmazonBestSellerRanks(`<html>${asin} Robot Check Best Sellers Rank #1 in Office Products</html>`,{asin}).status,'BLOCKED_PAGE');
});

test('BSR history requires same ASIN same category and at least 24 hours',()=>{
  const obs=[
    {asin,observedAt:'2026-08-26T04:00:00Z',bsrEntries:[{rank:100,category:'Office Products'},{rank:10,category:'View Binders'}]},
    {asin,observedAt:'2026-08-27T04:00:00Z',bsrEntries:[{rank:80,category:'Office Products'},{rank:12,category:'View Binders'}]}
  ];
  const h=buildComparableBsrHistory(obs);
  assert.equal(h.trendReadyCount,2);
  const overall=h.histories.find(x=>x.category==='Office Products');
  assert.equal(overall.rankImprovement,20);
  assert.equal(overall.rankVelocityPerDay,20);
  const niche=h.histories.find(x=>x.category==='View Binders');
  assert.equal(niche.rankImprovement,-2);
  assert.equal(h.purchaseAuthorized,false);
});

test('short interval cannot produce rank velocity',()=>{
  const h=buildComparableBsrHistory([
    {asin,observedAt:'2026-08-26T04:00:00Z',bsrEntries:[{rank:100,category:'Office Products'}]},
    {asin,observedAt:'2026-08-26T10:00:00Z',bsrEntries:[{rank:50,category:'Office Products'}]}
  ]);
  assert.equal(h.trendReadyCount,0);
  assert.equal(h.histories[0].rankVelocityPerDay,null);
});

test('collector has no paid provider and targets exactly the 13 real clean review-growth leaders',async()=>{
  const targets=JSON.parse(await fs.readFile(new URL('../data/amazon-round2-review-growth-leaders-bsr-targets-v1.json',import.meta.url),'utf8'));
  const script=await fs.readFile(new URL('../scripts/amazon-leader-bsr-snapshot.mjs',import.meta.url),'utf8');
  assert.equal(targets.targetCount,13);
  assert.equal(targets.targets.length,13);
  assert.equal(new Set(targets.targets.map(x=>x.asin)).size,13);
  assert.equal(targets.policy.providerSpendEur,0);
  assert.equal(targets.policy.paidCallsAuthorized,false);
  assert.equal(targets.policy.purchaseAuthorized,false);
  assert.doesNotMatch(script,/DATAFORSEO|KEEPA|SELLERSPRITE/i);
});
