import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRomaniaManualExactEvidence } from '../romania-manual-exact-evidence-v1.js';

const base = () => ({
  schemaVersion: 'MPR_ROMANIA_MANUAL_EXACT_EVIDENCE_V1',
  candidateAsin: 'B00INKVS82',
  comparabilityKey: 'THREE_RING_ROUND_RING_BINDERS',
  definitionConfirmed: true,
  observations: ['EMAG','TRENDYOL'].map(platform => ({
    platform,
    market: 'RO',
    sourceUrl: platform === 'EMAG' ? 'https://www.emag.ro/search/biblioraft%203%20inele' : 'https://www.trendyol.com/sr?q=binder%203%20inele',
    observedAt: '2026-08-26T08:00:00Z',
    manualReviewer: 'human-review',
    marketWideReviewed: true,
    comparabilityConfirmed: true,
    exactListingCount: platform === 'EMAG' ? 7 : 5,
    scope: 'MARKET_WIDE',
    evidenceNote: 'All result pages reviewed; canonical false positives excluded.',
    evidenceAttachmentRef: `manual://${platform.toLowerCase()}/evidence`
  })),
  policy: {
    unknownIsZero: false,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    paidCallsTriggered: 0,
    providerSpendEur: 0,
    purchaseAuthorized: false
  }
});

test('fails closed on untouched intake template', () => {
  const x = base();
  x.definitionConfirmed = false;
  x.observations[0].exactListingCount = null;
  x.observations[0].marketWideReviewed = false;
  const r = validateRomaniaManualExactEvidence(x);
  assert.equal(r.ok, false);
  assert.equal(r.promotionEligible, false);
  assert.equal(r.exactCounts, null);
});

test('passes only when both marketplaces have exact manually reviewed market-wide evidence', () => {
  const r = validateRomaniaManualExactEvidence(base());
  assert.equal(r.ok, true);
  assert.deepEqual(r.exactCounts, { EMAG: 7, TRENDYOL: 5 });
  assert.equal(r.salesEvidenceClass, 'NOT_VERIFIED_SALES');
  assert.equal(r.paidCallsTriggered, 0);
  assert.equal(r.purchaseAuthorized, false);
});

test('blocks promotion if one platform is only sampled', () => {
  const x = base();
  x.observations[1].scope = 'SAMPLED';
  x.observations[1].marketWideReviewed = false;
  const r = validateRomaniaManualExactEvidence(x);
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('TRENDYOL_SCOPE_NOT_MARKET_WIDE'));
  assert.equal(r.promotionEligible, false);
});
