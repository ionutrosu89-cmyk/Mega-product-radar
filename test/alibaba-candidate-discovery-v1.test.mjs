import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlibabaProductCandidates,AlibabaCandidateDiscoveryTruthPolicy} from '../alibaba-candidate-discovery-v1.js';

test('extracts and dedupes Alibaba product-detail URLs only',()=>{
  const html=`<a href="https://www.alibaba.com/product-detail/Foo-Bar_1601234567890.html?spm=a">x</a><script>{"url":"https:\\/\\/www.alibaba.com\\/product-detail\\/Foo-Bar_1601234567890.html"}</script><a href="https://www.alibaba.com/trade/search?SearchText=foo">s</a>`;
  const rows=extractAlibabaProductCandidates(html,{query:'foo',sourceUrl:'https://www.alibaba.com/trade/search?SearchText=foo'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].externalId,'1601234567890');
  assert.equal(rows[0].evidenceClass,'SUPPLIER_CANDIDATE_DISCOVERY_ONLY');
  assert.equal(rows[0].supplierPriceVerified,false);
  assert.equal(rows[0].matchVerified,false);
});

test('does not promote candidate URL into price or match evidence',()=>{
  assert.equal(AlibabaCandidateDiscoveryTruthPolicy.candidateUrlIsSupplierPriceEvidence,false);
  assert.equal(AlibabaCandidateDiscoveryTruthPolicy.candidateUrlIsMarketplaceMatch,false);
  assert.equal(AlibabaCandidateDiscoveryTruthPolicy.candidateUrlIsVerifiedQuote,false);
  assert.equal(AlibabaCandidateDiscoveryTruthPolicy.unknownEqualsZero,false);
  assert.equal(AlibabaCandidateDiscoveryTruthPolicy.purchaseAuthorized,false);
});
