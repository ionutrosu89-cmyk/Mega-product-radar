import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAmazonRound2Plan, deriveAmazonRound2Movement, summarizeAmazonRound2Movements } from '../amazon-round2-orchestrator-v1.js';

const files=[
  'data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',
  'data/live-snapshots/amazon-round1-remaining.compact.json',
  'data/live-snapshots/amazon-round1-missing-retry.compact.json'
];
const payloads=files.map(p=>JSON.parse(fs.readFileSync(p,'utf8')));

test('round2 plan contains exactly the 255 already captured live Amazon identities',()=>{
  const plan=buildAmazonRound2Plan(payloads,'2026-08-25T08:56:00.000Z',24);
  assert.equal(plan.capturedCount,255);
  assert.equal(new Set(plan.captured.map(x=>x.asin)).size,255);
  assert.equal(plan.paidCallsTriggered,0);
  assert.equal(plan.purchaseAuthorized,false);
});

test('round2 stays blocked on Aug 25 before the real 24h threshold',()=>{
  const plan=buildAmazonRound2Plan(payloads,'2026-08-25T08:56:00.000Z',24);
  assert.equal(plan.eligibleCount,0);
  assert.equal(plan.blockedCount,255);
  assert.ok(plan.nextEligibleAt.startsWith('2026-08-26T'));
  assert.ok(plan.allEligibleAt.startsWith('2026-08-26T'));
});

test('all 255 captured identities are eligible after the latest 24h threshold',()=>{
  const plan=buildAmazonRound2Plan(payloads,'2026-08-26T05:00:00.000Z',24);
  assert.equal(plan.eligibleCount,255);
  assert.equal(plan.blockedCount,0);
});

test('movement derives only public price and review changes after 24h',()=>{
  const previous={asin:'B012345678',price:20,reviewCount:100,observedAt:'2026-08-25T04:00:00Z'};
  const current={externalId:'B012345678',price:18,reviewCount:106,observedAt:'2026-08-26T04:00:00Z'};
  const x=deriveAmazonRound2Movement(previous,current);
  assert.equal(x.intervalEligible,true);
  assert.equal(x.priceDelta,-2);
  assert.equal(x.reviewDelta,6);
  assert.equal(x.reviewVelocityPerDay,6);
  assert.equal(x.rankVelocity,null);
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(x.purchaseAuthorized,false);
});

test('movement fails closed below 24h and never invents rank velocity',()=>{
  const x=deriveAmazonRound2Movement(
    {asin:'B012345678',price:20,reviewCount:100,observedAt:'2026-08-25T04:00:00Z'},
    {externalId:'B012345678',price:19,reviewCount:105,observedAt:'2026-08-26T03:59:59Z'}
  );
  assert.equal(x.intervalEligible,false);
  assert.equal(x.priceDelta,null);
  assert.equal(x.reviewDelta,null);
  assert.equal(x.reviewVelocityPerDay,null);
  assert.equal(x.rankVelocity,null);
});

test('summary cannot claim verified sales or rank velocity',()=>{
  const summary=summarizeAmazonRound2Movements([
    deriveAmazonRound2Movement(
      {asin:'B012345678',price:20,reviewCount:100,observedAt:'2026-08-25T04:00:00Z'},
      {externalId:'B012345678',price:20,reviewCount:101,observedAt:'2026-08-26T04:00:00Z'}
    )
  ]);
  assert.equal(summary.rankVelocityAvailable,0);
  assert.equal(summary.verifiedSalesRows,0);
  assert.equal(summary.purchaseAuthorized,false);
  assert.equal(summary.paidCallsTriggered,0);
});
