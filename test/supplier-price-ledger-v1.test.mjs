import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSupplierPriceLedger,normalizeSupplierCandidatePriceSnapshot} from '../supplier-price-ledger-v1.js';

const base=(overrides={})=>({
  platform:'ALIBABA',
  supplierListingId:'1600123456789',
  supplierName:'Example Supplier',
  sourceUrl:'https://www.alibaba.com/product-detail/example_1600123456789.html',
  title:'4 Pack Cotton Beach Towels',
  currency:'USD',
  publicPriceMin:4,
  publicPriceMax:7,
  moq:20,
  targetOrderQuantity:50,
  priceUnit:'piece',
  observedAt:'2026-08-29T12:00:00Z',
  linkedMarketplaceCanonicalProductId:'pf1_example',
  variantAttributes:{packCount:'4',material:'cotton'},
  ...overrides
});

test('ambiguous public range uses conservative maximum, never automatic minimum',()=>{
  const row=normalizeSupplierCandidatePriceSnapshot(base());
  assert.equal(row.valid,true);
  assert.equal(row.normalizedPublicUnitPrice,7);
  assert.equal(row.supplierPriceRuleUsed,'AMBIGUOUS_RANGE_USE_MAX');
  assert.equal(row.truthPolicy.ambiguousRangeUsesAutomaticMinimum,false);
});

test('exact target quantity tier is used when observable',()=>{
  const row=normalizeSupplierCandidatePriceSnapshot(base({
    publicPriceMin:null,publicPriceMax:null,
    priceTiers:[{minQty:1,maxQty:49,unitPrice:8},{minQty:50,maxQty:99,unitPrice:6},{minQty:100,unitPrice:5}],
    targetOrderQuantity:50
  }));
  assert.equal(row.valid,true);
  assert.equal(row.normalizedPublicUnitPrice,6);
  assert.equal(row.supplierPriceRuleUsed,'EXACT_TARGET_QTY_TIER');
});

test('public listing remains neither verified quote nor landed cost',()=>{
  const row=normalizeSupplierCandidatePriceSnapshot(base());
  assert.equal(row.evidenceClass,'PUBLIC_SUPPLIER_LISTING');
  assert.equal(row.verifiedQuote,false);
  assert.equal(row.landedCostConfirmed,false);
  assert.equal(row.negotiatedPriceIncluded,false);
  assert.equal(row.truthPolicy.publicListingIsVerifiedQuote,false);
  assert.equal(row.truthPolicy.publicSupplierPriceIsLandedCost,false);
});

test('catalogue candidate without public price fails closed for price ledger',()=>{
  const row=normalizeSupplierCandidatePriceSnapshot(base({publicPriceMin:null,publicPriceMax:null,priceTiers:[]}));
  assert.equal(row.valid,false);
  assert.ok(row.blockers.includes('PUBLIC_PRICE_REQUIRED'));
  assert.ok(row.blockers.includes('NORMALIZED_PUBLIC_PRICE_UNRESOLVED'));
});

test('source and timestamp provenance are mandatory',()=>{
  const row=normalizeSupplierCandidatePriceSnapshot(base({sourceUrl:null,observedAt:null}));
  assert.equal(row.valid,false);
  assert.ok(row.blockers.includes('SOURCE_URL_REQUIRED'));
  assert.ok(row.blockers.includes('OBSERVED_AT_REQUIRED'));
});

test('marketplace canonical link remains unresolved rather than fabricated',()=>{
  const row=normalizeSupplierCandidatePriceSnapshot(base({linkedMarketplaceCanonicalProductId:null}));
  assert.equal(row.valid,true);
  assert.equal(row.linkedMarketplaceCanonicalProductId,null);
  assert.equal(row.marketplaceLinkStatus,'UNRESOLVED');
  assert.equal(row.truthPolicy.unresolvedMarketplaceLinkMayBeInvented,false);
});

test('same supplier listing at two timestamps preserves price history',()=>{
  const ledger=buildSupplierPriceLedger([
    base({observedAt:'2026-08-29T12:00:00Z',publicPriceMax:7}),
    base({observedAt:'2026-08-30T12:00:00Z',publicPriceMax:6.5})
  ]);
  assert.equal(ledger.supplierListingCount,1);
  assert.equal(ledger.snapshotCount,2);
  assert.equal(ledger.listings[0].snapshotCount,2);
  assert.equal(ledger.listings[0].latestNormalizedPublicUnitPrice,6.5);
});

test('exact duplicate supplier snapshot is deduplicated',()=>{
  const ledger=buildSupplierPriceLedger([base(),base()]);
  assert.equal(ledger.snapshotCount,1);
  assert.equal(ledger.duplicateSnapshotCount,1);
});

test('conflicting marketplace links fail closed',()=>{
  const ledger=buildSupplierPriceLedger([
    base({linkedMarketplaceCanonicalProductId:'pf1_a',observedAt:'2026-08-29T12:00:00Z'}),
    base({linkedMarketplaceCanonicalProductId:'pf1_b',observedAt:'2026-08-30T12:00:00Z'})
  ]);
  assert.equal(ledger.marketplaceLinkConflictCount,1);
  assert.equal(ledger.listings[0].linkedMarketplaceCanonicalProductId,null);
  assert.equal(ledger.listings[0].marketplaceLinkStatus,'CONFLICT');
});
