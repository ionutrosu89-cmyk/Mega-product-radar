import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync(new URL('../data/collection-manifest-v1.json',import.meta.url),'utf8'));

test('priority collection starts with the only strict target-niche Amazon identity missing first live',()=>{
  assert.equal(manifest.priorityFirstLive.length,1);
  const p=manifest.priorityFirstLive[0];
  assert.equal(p.externalId,'B0CHYDX91L');
  assert.equal(p.canonicalNicheKey,'ADJUSTABLE_LAPTOP_STANDS');
  assert.equal(p.hasFirstLiveObservation,false);
  assert.equal(p.eligibleNow,true);
  assert.equal(p.evidenceUse,'FIRST_LIVE_PRODUCT_PAGE_OBSERVATION_ONLY');
});

test('Round2 remains time-gated and cannot invent rank or verified sales',()=>{
  assert.equal(manifest.round2.expectedIdentityCount,255);
  assert.equal(manifest.round2.minimumEligibleAtUtc,'2026-08-26T03:56:23.583Z');
  assert.equal(manifest.round2.executionBeforeThreshold,false);
  assert.deepEqual(manifest.round2.eligibleEvidenceAfterThreshold,['PRICE_MOVEMENT','REVIEW_COUNT_MOVEMENT']);
  assert.equal(manifest.round2.rankVelocityAllowedWithoutExplicitRankEvidence,false);
  assert.equal(manifest.round2.verifiedSalesAllowed,false);
});

test('collection manifest is zero-spend and has no execution or purchase authority',()=>{
  assert.equal(manifest.policy.paidCallsTriggered,0);
  assert.equal(manifest.policy.providerSpend,0);
  assert.equal(manifest.policy.purchaseAuthorized,false);
  assert.equal(manifest.policy.autoExecutionAuthorized,false);
  assert.equal(manifest.policy.unknownIsNotZero,true);
  assert.equal(manifest.policy.firstLiveObservationDoesNotCreateTrend,true);
});
