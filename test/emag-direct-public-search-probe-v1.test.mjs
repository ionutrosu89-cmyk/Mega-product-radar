import test from 'node:test';
import assert from 'node:assert/strict';
import { EMAG_PUBLIC_SEARCH_TARGETS, buildEmagSearchUrl, parseEmagSearchHtml } from '../emag-public-search-probe.js';

test('probe targets only the prioritized canonical Romania niches', () => {
  assert.deepEqual(
    EMAG_PUBLIC_SEARCH_TARGETS.map(x => x.nicheKey),
    ['travel:packing-cubes', 'automotive:trunk-organization', 'office:laptop-accessories', 'office:three-ring-binders']
  );
  for (const target of EMAG_PUBLIC_SEARCH_TARGETS) {
    assert.match(buildEmagSearchUrl(target.query), /^https:\/\/www\.emag\.ro\/search\//);
  }
});

test('parser counts unique eMAG product links as a lower bound only', () => {
  const html = `
    <html><head><title>Organizator portbagaj - eMAG.ro</title></head><body>
      <div>245 produse</div>
      <a href="/organizator-a/pd/ABC123/">A</a>
      <a href="https://www.emag.ro/organizator-b/pd/XYZ789/?ref=search">B</a>
      <a href="/organizator-a/pd/ABC123/?ref=dup">A duplicate</a>
    </body></html>`;
  const parsed = parseEmagSearchHtml(html, EMAG_PUBLIC_SEARCH_TARGETS[1]);
  assert.equal(parsed.blocked, false);
  assert.equal(parsed.productLinkLowerBound, 2);
  assert.equal(parsed.productUrls.length, 2);
  assert.equal(parsed.declaredResultCountCandidate, 245);
  assert.equal(parsed.declaredResultCountTrusted, false);
  assert.equal(parsed.sellerCount, null);
  assert.equal(parsed.salesEvidenceClass, 'NOT_VERIFIED_SALES');
  assert.equal(parsed.purchaseAuthorized, false);
});

test('declared result count never becomes trusted automatically', () => {
  const parsed = parseEmagSearchHtml('<div>1.234 produse</div>', EMAG_PUBLIC_SEARCH_TARGETS[0]);
  assert.equal(parsed.declaredResultCountCandidate, 1234);
  assert.equal(parsed.declaredResultCountTrusted, false);
  assert.equal(parsed.productLinkLowerBound, 0);
});

test('blocked pages are detected and cannot masquerade as evidence', () => {
  const parsed = parseEmagSearchHtml('<html><body>Verify you are human - CAPTCHA</body></html>', EMAG_PUBLIC_SEARCH_TARGETS[0]);
  assert.equal(parsed.blocked, true);
  assert.equal(parsed.productLinkLowerBound, 0);
  assert.equal(parsed.declaredResultCountTrusted, false);
});

test('non-eMAG and malformed product links are ignored', () => {
  const html = `
    <a href="https://example.com/item/pd/ABC123/">wrong host</a>
    <a href="/not-a-product/ABC123/">wrong path</a>
    <a href="/valid-item/pd/GOOD123/">valid</a>`;
  const parsed = parseEmagSearchHtml(html, EMAG_PUBLIC_SEARCH_TARGETS[2]);
  assert.equal(parsed.productLinkLowerBound, 1);
  assert.match(parsed.productUrls[0], /^https:\/\/www\.emag\.ro\/valid-item\/pd\/GOOD123\//);
});
