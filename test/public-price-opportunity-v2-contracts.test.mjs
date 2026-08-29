import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductFingerprint,fingerprintHardMismatches,ProductFingerprintTruthPolicy} from '../product-fingerprint-v1.js';
import {normalizeMarketplacePriceObservation,normalizeSupplierPriceObservation,chooseConservativePublicSupplierPrice} from '../public-price-observation-v1.js';

const towel=overrides=>buildProductFingerprint({
  category:'Home',productType:'Beach Towel',primaryFunction:'Beach drying',packCount:4,material:'100% Cotton',
  dimensions:{lengthCm:180,widthCm:100},unitWeightGrams:400,formFactor:'towel',sourceTitle:'Oversized cotton beach towels pack of 4',...overrides
});

test('ProductFingerprint is stable under whitespace/case and dimension orientation',()=>{
  const a=towel({});
  const b=buildProductFingerprint({category:' HOME ',productType:'BEACH TOWEL',primaryFunction:'Beach   drying',packCount:4,material:'100% COTTON',dimensions:{lengthCm:100,widthCm:180},unitWeightGrams:400,formFactor:'TOWEL'});
  assert.equal(a.canonicalProductId,b.canonicalProductId);
  assert.equal(a.identityHash,b.identityHash);
});

test('pack count mismatch is a hard identity mismatch',()=>{
  const a=towel({packCount:4});
  const b=towel({packCount:2});
  assert.notEqual(a.canonicalProductId,b.canonicalProductId);
  assert.ok(fingerprintHardMismatches(a,b).includes('PACK_COUNT_MISMATCH'));
  assert.equal(ProductFingerprintTruthPolicy.differentPackSizesMayMerge,false);
});

test('material and materially different dimensions are hard mismatches',()=>{
  const a=towel({});
  const b=towel({material:'microfiber',dimensions:{lengthCm:150,widthCm:75}});
  const mismatches=fingerprintHardMismatches(a,b);
  assert.ok(mismatches.includes('MATERIAL_MISMATCH'));
  assert.ok(mismatches.includes('DIMENSION_MISMATCH'));
});

test('marketplace public price never claims realized or verified sales',()=>{
  const r=normalizeMarketplacePriceObservation({platform:'amazon',canonicalProductId:'pf1_abc',marketplaceListingId:'B08BJHMY33',sourceUrl:'https://example.com/product',currency:'USD',priceGross:39.99,observedAt:'2026-08-29T12:00:00Z',shippingPrice:0,confidence:95});
  assert.equal(r.valid,true);
  assert.equal(r.evidenceClass,'PUBLIC_MARKETPLACE_LISTING');
  assert.equal(r.truthPolicy.marketplacePriceIsRealizedSale,false);
  assert.equal(r.truthPolicy.verifiedSales,false);
});

test('missing marketplace price fails closed instead of becoming zero',()=>{
  const r=normalizeMarketplacePriceObservation({platform:'amazon',canonicalProductId:'pf1_abc',marketplaceListingId:'B08',sourceUrl:'https://example.com',currency:'USD',priceGross:null,observedAt:'2026-08-29T12:00:00Z'});
  assert.equal(r.valid,false);
  assert.equal(r.priceGross,null);
  assert.ok(r.blockers.includes('POSITIVE_GROSS_PRICE_REQUIRED'));
});

test('ambiguous supplier range uses public maximum, never automatic minimum',()=>{
  const selected=chooseConservativePublicSupplierPrice({publicPriceMin:3,publicPriceMax:8});
  assert.equal(selected.price,8);
  assert.equal(selected.rule,'AMBIGUOUS_RANGE_USE_MAX');
});

test('supplier exact target quantity tier takes precedence when resolved',()=>{
  const selected=chooseConservativePublicSupplierPrice({targetOrderQuantity:100,priceTiers:[{minQty:10,maxQty:49,unitPrice:9},{minQty:50,maxQty:199,unitPrice:7},{minQty:200,unitPrice:5}]});
  assert.equal(selected.price,7);
  assert.equal(selected.rule,'EXACT_TARGET_QTY_TIER');
});

test('supplier listing remains public listing, not quote or landed cost',()=>{
  const r=normalizeSupplierPriceObservation({platform:'1688',supplierListingId:'offer-1',supplierName:'Factory',sourceUrl:'https://detail.1688.com/offer/1.html',currency:'CNY',publicPriceMin:20,publicPriceMax:35,moq:50,targetOrderQuantity:100,priceUnit:'piece',observedAt:'2026-08-29T12:00:00Z'});
  assert.equal(r.valid,true);
  assert.equal(r.normalizedPublicUnitPrice,35);
  assert.equal(r.verifiedQuote,false);
  assert.equal(r.negotiatedPriceIncluded,false);
  assert.equal(r.truthPolicy.supplierPriceIsLandedCost,false);
  assert.equal(r.truthPolicy.negotiationIncludedInBaseCase,false);
});

test('supplier observation with null prices fails closed',()=>{
  const r=normalizeSupplierPriceObservation({platform:'alibaba',supplierListingId:'x',sourceUrl:'https://example.com',currency:'USD',priceUnit:'piece',observedAt:'2026-08-29T12:00:00Z',publicPriceMin:null,publicPriceMax:null});
  assert.equal(r.valid,false);
  assert.equal(r.normalizedPublicUnitPrice,null);
  assert.ok(r.blockers.includes('PUBLIC_PRICE_REQUIRED'));
  assert.ok(r.blockers.includes('NORMALIZED_PUBLIC_PRICE_UNRESOLVED'));
});
