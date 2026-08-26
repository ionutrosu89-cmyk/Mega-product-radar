import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TRENDYOL_PUBLIC_SEARCH_TARGETS, buildTrendyolSearchUrl, parseTrendyolSearchHtml } from '../trendyol-public-search-probe.js';

const pack = JSON.parse(fs.readFileSync(new URL('../data/romania-binder-review-pack-b00inkvs82-v1.json', import.meta.url), 'utf8'));

test('binder review pack creates exactly one direct task per Romania marketplace', () => {
  assert.equal(pack.candidate.externalId, 'B00INKVS82');
  assert.equal(pack.candidate.comparabilityKey, 'THREE_RING_ROUND_RING_BINDERS');
  assert.deepEqual(pack.tasks.map(x => x.platform), ['EMAG', 'TRENDYOL']);
  assert.ok(pack.tasks.every(x => x.sourceType === 'DIRECT_PUBLIC_SEARCH'));
});

test('review pack starts fail-closed with no exact Romania competition evidence', () => {
  assert.equal(pack.definitionConfirmed, false);
  assert.equal(pack.promotion.exactRomaniaGapConfirmed, false);
  assert.equal(pack.promotion.promotionEligible, false);
  for (const task of pack.tasks) {
    assert.equal(task.observedAt, null);
    assert.equal(task.listingCount, null);
    assert.equal(task.listingCountLowerBound, null);
    assert.equal(task.marketWideReviewed, false);
    assert.equal(task.comparabilityConfirmed, false);
  }
});

test('Trendyol probe targets only the staged binder niche and builds public search URL', () => {
  assert.deepEqual(TRENDYOL_PUBLIC_SEARCH_TARGETS.map(x => x.nicheKey), ['office:three-ring-binders']);
  assert.match(buildTrendyolSearchUrl(TRENDYOL_PUBLIC_SEARCH_TARGETS[0].query), /^https:\/\/www\.trendyol\.com\/sr\?q=/);
});

test('Trendyol parser treats unique product links as lower bound and declared count as untrusted', () => {
  const html = `
    <div>1.234 ürün</div>
    <a href="/marka/a-urun-p-12345?boutiqueId=1">A</a>
    <a href="https://www.trendyol.com/marka/b-urun-p-67890?merchantId=2">B</a>
    <a href="/marka/a-urun-p-12345?dup=1">duplicate</a>`;
  const parsed = parseTrendyolSearchHtml(html, TRENDYOL_PUBLIC_SEARCH_TARGETS[0]);
  assert.equal(parsed.blocked, false);
  assert.equal(parsed.productLinkLowerBound, 2);
  assert.equal(parsed.declaredResultCountCandidate, 1234);
  assert.equal(parsed.declaredResultCountTrusted, false);
  assert.equal(parsed.marketWideReviewed, false);
  assert.equal(parsed.salesEvidenceClass, 'NOT_VERIFIED_SALES');
  assert.equal(parsed.purchaseAuthorized, false);
});

test('blocked Trendyol page cannot masquerade as market evidence', () => {
  const parsed = parseTrendyolSearchHtml('Verify you are human CAPTCHA', TRENDYOL_PUBLIC_SEARCH_TARGETS[0]);
  assert.equal(parsed.blocked, true);
  assert.equal(parsed.productLinkLowerBound, 0);
  assert.equal(parsed.declaredResultCountTrusted, false);
});

test('review pack and probe preserve zero-spend no-buy policy', () => {
  assert.equal(pack.policy.networkExecutionIncluded, false);
  assert.equal(pack.policy.paidCallsTriggered, 0);
  assert.equal(pack.policy.providerSpendEur, 0);
  assert.equal(pack.policy.purchaseAuthorized, false);
});
