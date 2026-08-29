import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptAmazonLiveRefreshObservation,buildMarketplacePriceLedger,normalizeMarketplaceListingSnapshot} from '../marketplace-price-ledger-v1.js';

const base=(overrides={})=>({
  marketplace:'AMAZON',
  externalProductId:'B012345678',
  sourceUrl:'https://www.amazon.com/dp/B012345678',
  title:'Example Product',
  price:29.99,
  currency:'USD',
  observedAt:'2026-08-29T12:00:00Z',
  ...overrides
});

test('unknown commercial fields remain null rather than zero',()=>{
  const row=normalizeMarketplaceListingSnapshot(base({price:null,currency:null,rating:null,reviewCount:null,shipping:null}));
  assert.equal(row.valid,true);
  assert.equal(row.price,null);
  assert.equal(row.rating,null);
  assert.equal(row.reviewCount,null);
  assert.equal(row.shipping,null);
  assert.equal(row.truthPolicy.unknownEqualsZero,false);
});

test('source URL external id and observed timestamp are mandatory provenance',()=>{
  const row=normalizeMarketplaceListingSnapshot({marketplace:'AMAZON',price:10,currency:'USD'});
  assert.equal(row.valid,false);
  assert.ok(row.blockers.includes('EXTERNAL_PRODUCT_ID_REQUIRED'));
  assert.ok(row.blockers.includes('SOURCE_URL_REQUIRED'));
  assert.ok(row.blockers.includes('OBSERVED_AT_REQUIRED'));
});

test('same listing at same timestamp dedupes as exact snapshot duplicate',()=>{
  const ledger=buildMarketplacePriceLedger([base(),base()]);
  assert.equal(ledger.listingCount,1);
  assert.equal(ledger.snapshotCount,1);
  assert.equal(ledger.duplicateSnapshotCount,1);
});

test('same listing at a later timestamp is preserved as second snapshot',()=>{
  const ledger=buildMarketplacePriceLedger([
    base({observedAt:'2026-08-29T12:00:00Z',price:29.99}),
    base({observedAt:'2026-08-30T12:00:00Z',price:31.99})
  ]);
  assert.equal(ledger.listingCount,1);
  assert.equal(ledger.snapshotCount,2);
  assert.equal(ledger.listings[0].snapshotCount,2);
  assert.equal(ledger.listings[0].firstSeenAt,'2026-08-29T12:00:00.000Z');
  assert.equal(ledger.listings[0].lastSeenAt,'2026-08-30T12:00:00.000Z');
  assert.equal(ledger.listings[0].snapshots[1].price,31.99);
});

test('listing identity and canonical product identity are separate layers',()=>{
  const ledger=buildMarketplacePriceLedger([
    base({externalProductId:'B012345678',canonicalProductId:'pf1_same'}),
    base({externalProductId:'B087654321',sourceUrl:'https://www.amazon.com/dp/B087654321',canonicalProductId:'pf1_same'})
  ]);
  assert.equal(ledger.listingCount,2);
  assert.equal(ledger.canonicalProductCount,1);
  assert.deepEqual(ledger.canonicalProducts[0].listingKeys,['AMAZON:B012345678','AMAZON:B087654321']);
  assert.equal(ledger.truthPolicy.listingDeduplicationIsCanonicalProductDeduplication,false);
});

test('unresolved canonical identity is retained as unknown and never invented',()=>{
  const ledger=buildMarketplacePriceLedger([base({canonicalProductId:null})]);
  assert.equal(ledger.listingCount,1);
  assert.equal(ledger.canonicalProductCount,0);
  assert.equal(ledger.unresolvedCanonicalListingCount,1);
  assert.equal(ledger.listings[0].canonicalProductId,null);
  assert.equal(ledger.listings[0].canonicalIdentityStatus,'UNRESOLVED');
});

test('conflicting canonical assignments fail closed at listing aggregation level',()=>{
  const ledger=buildMarketplacePriceLedger([
    base({canonicalProductId:'pf1_a',observedAt:'2026-08-29T12:00:00Z'}),
    base({canonicalProductId:'pf1_b',observedAt:'2026-08-30T12:00:00Z'})
  ]);
  assert.equal(ledger.canonicalConflictListingCount,1);
  assert.equal(ledger.listings[0].canonicalProductId,null);
  assert.equal(ledger.listings[0].canonicalIdentityStatus,'CONFLICT');
});

test('review count and rank signals never become verified sales',()=>{
  const row=normalizeMarketplaceListingSnapshot(base({reviewCount:420,rankSignals:[{type:'BSR',rank:120}]}));
  assert.equal(row.reviewCount,420);
  assert.equal(row.verifiedSales,false);
  assert.equal(row.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(row.truthPolicy.reviewCountIsVerifiedSales,false);
  assert.equal(row.truthPolicy.rankSignalIsVerifiedSales,false);
});

test('legacy Amazon live refresh observations adapt without fabricating canonical identity',()=>{
  const row=adaptAmazonLiveRefreshObservation({
    externalId:'B012345678',
    url:'https://www.amazon.com/dp/B012345678',
    title:'Amazon Example',
    price:22.5,
    currency:'USD',
    rating:4.6,
    reviewCount:125,
    sourceRank:50,
    observedAt:'2026-08-29T12:00:00Z',
    evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE'
  });
  assert.equal(row.valid,true);
  assert.equal(row.listingKey,'AMAZON:B012345678');
  assert.equal(row.canonicalProductId,null);
  assert.equal(row.canonicalIdentityStatus,'UNRESOLVED');
  assert.equal(row.rankSignals[0].rank,50);
});
