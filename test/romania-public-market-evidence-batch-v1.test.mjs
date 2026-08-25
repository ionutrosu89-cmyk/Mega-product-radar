import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../data/romania-public-market-evidence-batch-v1.json', import.meta.url);
const data = JSON.parse(await readFile(path, 'utf8'));

test('Romania evidence batch remains zero-spend and non-purchasing', () => {
  assert.equal(data.salesEvidenceClass, 'NOT_VERIFIED_SALES');
  assert.equal(data.purchaseAuthorized, false);
  assert.equal(data.paidCallsTriggered, 0);
  assert.equal(data.approvedSpendEur, 0);
});

test('batch covers three canonical MPR niches without claiming Romania Gap readiness', () => {
  assert.equal(data.niches.length, 3);
  assert.deepEqual(
    data.niches.map(x => x.nicheKey),
    ['travel:packing-cubes', 'automotive:trunk-organization', 'office:laptop-accessories']
  );
  assert.equal(data.batchGate.readyForRomaniaGapCompetition, 0);
  assert.ok(data.niches.every(x => x.gate.romaniaGapCompetitionReady === false));
});

test('Trendyol lower bounds stay lower bounds and exact counts remain unknown', () => {
  const expected = new Map([
    ['travel:packing-cubes', 656],
    ['automotive:trunk-organization', 512],
    ['office:laptop-accessories', 1636]
  ]);

  for (const niche of data.niches) {
    const obs = niche.observations.find(x => x.platform === 'TRENDYOL');
    assert.ok(obs);
    assert.equal(obs.evidenceSource, 'DIRECT_MARKETPLACE_PAGE');
    assert.equal(obs.listingCountLowerBound, expected.get(niche.nicheKey));
    assert.equal(obs.listingCount, null);
    assert.equal(obs.sellerCount, null);
    assert.match(obs.sourceUrl, /^https:\/\/www\.trendyol\.com\/ro\//);
    assert.ok(obs.observedAt);
  }
});

test('third-party indexed eMAG offers prove presence only and never market-wide competition', () => {
  for (const niche of data.niches) {
    const obs = niche.observations.find(x => x.platform === 'EMAG');
    assert.ok(obs);
    assert.equal(obs.evidenceSource, 'THIRD_PARTY_INDEXER');
    assert.equal(obs.scope, 'PRODUCT_PRESENCE_ONLY');
    assert.equal(obs.comparableScopeConfirmed, false);
    assert.equal(obs.listingCountLowerBound, 1);
    assert.equal(obs.listingCount, null);
    assert.equal(obs.sellerCount, null);
    assert.equal(obs.sourceUrl, null);
    assert.match(obs.evidenceUrl, /^https:\/\/www\.pricy\.ro\//);
  }
});

test('noisy scopes are explicitly downgraded instead of silently counted', () => {
  const laptop = data.niches.find(x => x.nicheKey === 'office:laptop-accessories');
  assert.equal(laptop.scopeConfidence, 'MEDIUM');
  assert.equal(laptop.gate.status, 'REVIEW_REQUIRED');
  assert.ok(laptop.gate.blockers.includes('TRENDYOL_CATEGORY_SCOPE_NOISY'));

  const rejected = data.batchGate.rejectedCandidateScopes.find(
    x => x.nicheKey === 'home-organization:drawer-organization'
  );
  assert.ok(rejected);
  assert.match(rejected.reason, /CONTAMINATED/);
});
