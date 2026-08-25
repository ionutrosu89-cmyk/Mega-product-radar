import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildAmazonRound2PreliminaryTrendEvidence,round2ArtifactToProductSnapshots,appendAmazonRound2ToSnapshotLedger} from '../amazon-round2-trend-bridge-v1.js';

const movement={
  asin:'B012345678',previousObservedAt:'2026-08-25T04:00:00Z',currentObservedAt:'2026-08-26T04:00:00Z',elapsedHours:24,daysObserved:1,intervalEligible:true,
  pricePrevious:20,priceCurrent:18,priceDelta:-2,reviewCountPrevious:100,reviewCountCurrent:106,reviewDelta:6,reviewVelocityPerDay:6,
  sourceRankPrevious:null,sourceRankCurrent:null,rankVelocity:null,trendEvidenceClass:'LONGITUDINAL_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
};
const observation={platform:'AMAZON',externalId:'B012345678',observedAt:'2026-08-26T04:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:18,currency:'USD',rating:4.5,reviewCount:106,sourceRank:null,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false};
const artifact={
  schemaVersion:'MPR_AMAZON_ROUND2_REFRESH_V1',observations:[observation],movements:[movement],
  policy:{minimumObservationIntervalHours:24,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,rankVelocityAvailable:false}
};

test('valid >=24h Round2 movement becomes preliminary review-price evidence only',()=>{
  const r=buildAmazonRound2PreliminaryTrendEvidence(artifact);
  assert.equal(r.ok,true);
  assert.equal(r.eligible,1);
  assert.equal(r.rows[0].reviewVelocityPerDay,6);
  assert.equal(r.rows[0].priceDelta,-2);
  assert.equal(r.rows[0].preliminarySignal,'REVIEWS_INCREASING');
  assert.equal(r.rows[0].trendEvidenceLevel,'PRELIMINARY_REVIEW_PRICE_ONLY');
  assert.equal(r.rows[0].rankVelocityPerDay,null);
  assert.equal(r.rows[0].eligibleForRankTrend,false);
  assert.equal(r.rows[0].eligibleForDemandConfirmation,false);
  assert.equal(r.rows[0].eligibleForVerifiedSales,false);
  assert.equal(r.rows[0].maximumFunnelContribution,'PROMISING_SUPPORT_ONLY');
});

test('below-24h movement is rejected and cannot create trend evidence',()=>{
  const bad={...artifact,movements:[{...movement,currentObservedAt:'2026-08-26T03:59:59Z',elapsedHours:23.9997,intervalEligible:false,reviewDelta:null,reviewVelocityPerDay:null}]};
  const r=buildAmazonRound2PreliminaryTrendEvidence(bad);
  assert.equal(r.eligible,0);
  assert.equal(r.status,'NO_ELIGIBLE_MOVEMENTS');
  assert.equal(r.rejected[0].error,'MINIMUM_24H_INTERVAL_NOT_MET');
});

test('rank fields in Round2 movement fail closed rather than becoming inferred rank trend',()=>{
  const bad={...artifact,movements:[{...movement,sourceRankCurrent:5,rankVelocity:2}]};
  const r=buildAmazonRound2PreliminaryTrendEvidence(bad);
  assert.equal(r.eligible,0);
  assert.equal(r.rejected[0].error,'ROUND2_RANK_EVIDENCE_NOT_ALLOWED');
  assert.equal(r.rankVelocityAvailable,0);
});

test('review decline is preserved as observation but never interpreted as sales',()=>{
  const declining={...artifact,movements:[{...movement,reviewCountPrevious:106,reviewCountCurrent:104,reviewDelta:-2,reviewVelocityPerDay:-2}]};
  const r=buildAmazonRound2PreliminaryTrendEvidence(declining);
  assert.equal(r.rows[0].preliminarySignal,'REVIEWS_DECREASING');
  assert.equal(r.rows[0].reviewDelta,-2);
  assert.equal(r.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(r.verifiedSalesRows,0);
});

test('invalid or fabricated Round2 artifact policy is blocked',()=>{
  const bad={...artifact,policy:{...artifact.policy,minimumObservationIntervalHours:12}};
  const r=buildAmazonRound2PreliminaryTrendEvidence(bad);
  assert.equal(r.ok,false);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.error,'ROUND2_ARTIFACT_POLICY_INVALID');
});

test('Round2 observations append to product snapshot ledger and create legitimate >=24h history',()=>{
  const round1=[{platform:'AMAZON',externalId:'B012345678',observedAt:'2026-08-25T04:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',price:20,currency:'USD',rating:4.5,reviewCount:100,sourceRank:null,sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE'}];
  const r=appendAmazonRound2ToSnapshotLedger({round1Snapshots:round1,artifact});
  assert.equal(r.ok,true);
  assert.equal(r.ledgerSnapshots.length,2);
  assert.equal(r.trendReadyCount,1);
  assert.equal(r.history.products[0].reviewVelocityPerDay,6);
  assert.equal(r.history.products[0].rankVelocityPerDay,null);
  assert.equal(r.purchaseAuthorized,false);
});

test('duplicate current snapshot is not silently duplicated in append-only ledger',()=>{
  const round1=[{platform:'AMAZON',externalId:'B012345678',observedAt:'2026-08-25T04:00:00Z',freshnessClass:'LIVE_PUBLIC_PAGE',reviewCount:100}];
  const first=appendAmazonRound2ToSnapshotLedger({round1Snapshots:round1,artifact});
  const second=appendAmazonRound2ToSnapshotLedger({existingSnapshots:first.ledgerSnapshots,artifact});
  assert.equal(second.ledgerSnapshots.length,2);
  assert.ok(second.rejected.some(x=>x.errors?.includes('DUPLICATE_SNAPSHOT')));
});

test('bridge contains no network execution and never authorizes purchase',async()=>{
  const js=await fs.readFile(new URL('../amazon-round2-trend-bridge-v1.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(/);
  const snapshots=round2ArtifactToProductSnapshots(artifact);
  assert.equal(snapshots.paidCallsTriggered,0);
  assert.equal(snapshots.purchaseAuthorized,false);
  const r=buildAmazonRound2PreliminaryTrendEvidence(artifact);
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.purchaseAuthorized,false);
});
