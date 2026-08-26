import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/romania-binder-public-evidence.yml', 'utf8');
const trigger = JSON.parse(fs.readFileSync('data/romania-binder-public-evidence-trigger-2026-08-26.json', 'utf8'));
const collector = fs.readFileSync('scripts/romania-binder-public-evidence.mjs', 'utf8');

test('Romania binder workflow is one-time marker scoped and targets only eMAG plus Trendyol', () => {
  assert.match(workflow, /romania-binder-public-evidence-trigger-2026-08-26\.json/);
  assert.deepEqual(trigger.platforms, ['EMAG', 'TRENDYOL']);
  assert.equal(trigger.candidateAsin, 'B00INKVS82');
  assert.equal(trigger.comparabilityKey, 'THREE_RING_ROUND_RING_BINDERS');
});

test('Romania binder collection cannot fabricate exact competition', () => {
  assert.match(collector, /listingCount: null/);
  assert.match(collector, /declaredResultCountTrusted: false/);
  assert.match(collector, /marketWideReviewed: false/);
  assert.match(collector, /comparabilityConfirmed: false/);
  assert.match(collector, /exactRomaniaGapConfirmed: false/);
  assert.match(collector, /promotionEligible: false/);
});

test('Romania binder public collection stays zero-spend non-sales and non-purchasing', () => {
  assert.equal(trigger.providerSpendEur, 0);
  assert.equal(trigger.paidCallsAuthorized, false);
  assert.equal(trigger.purchaseAuthorized, false);
  assert.match(collector, /providerSpendEur: 0/);
  assert.match(collector, /paidCallsTriggered: 0/);
  assert.match(collector, /salesEvidenceClass: 'NOT_VERIFIED_SALES'/);
  assert.match(collector, /purchaseAuthorized: false/);
});
