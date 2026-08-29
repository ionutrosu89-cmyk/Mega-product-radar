import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPricePairReadiness} from '../price-pair-readiness-v1.js';

const marketDoc={schemaVersion:'MPR_MARKETPLACE_PRICE_LEDGER_V1',listings:[{listingKey:'AMAZON:A1',canonicalProductId:'P1',sourceUrl:'https://amazon.example/a1',lastSeenAt:'2026-08-29T10:00:00Z',snapshots:[{price:100,currency:'RON',sourceUrl:'https://amazon.example/a1',observedAt:'2026-08-29T10:00:00Z'}]}]};
const supplierDoc={schemaVersion:'MPR_SUPPLIER_PRICE_LEDGER_V1',listings:[{listingKey:'ALIBABA:S1',linkedMarketplaceCanonicalProductId:'P1',sourceUrl:'https://alibaba.example/s1',lastSeenAt:'2026-08-29T10:05:00Z',latestNormalizedPublicUnitPrice:20,latestCurrency:'RON',snapshots:[{normalizedPublicUnitPrice:20,currency:'RON',sourceUrl:'https://alibaba.example/s1',observedAt:'2026-08-29T10:05:00Z'}]}]};

test('price pair exists but cannot enter economics without match confidence',()=>{
  const r=assessPricePairReadiness({marketplaceDocuments:[marketDoc],supplierDocuments:[supplierDoc]});
  assert.equal(r.pairs.pricePairCount,1);
  assert.equal(r.pairs.screeningEconomicsReadyCount,0);
  assert.deepEqual(r.pairs.rows[0].blockers,['MATCH_CONFIDENCE_MISSING']);
});

test('match confidence >=80 unlocks screening readiness only',()=>{
  const r=assessPricePairReadiness({marketplaceDocuments:[marketDoc],supplierDocuments:[supplierDoc],matchRecords:[{marketplaceListingKey:'AMAZON:A1',supplierListingKey:'ALIBABA:S1',matchConfidence:91}]});
  assert.equal(r.pairs.screeningEconomicsReadyCount,1);
  assert.equal(r.truthPolicy.pricePairIsConfirmedLandedEconomics,false);
  assert.equal(r.truthPolicy.verifiedSales,false);
});

test('missing supplier public price is not price evidence',()=>{
  const bad=structuredClone(supplierDoc);
  bad.listings[0].latestNormalizedPublicUnitPrice=null;
  bad.listings[0].snapshots[0].normalizedPublicUnitPrice=null;
  const r=assessPricePairReadiness({marketplaceDocuments:[marketDoc],supplierDocuments:[bad]});
  assert.equal(r.supplier.priceReady,0);
  assert.equal(r.pairs.pricePairCount,0);
  assert.equal(r.blockerCounts.SUPPLIER_PUBLIC_PRICE_MISSING,1);
});

test('unresolved canonical ids do not pair by title or coincidence',()=>{
  const bad=structuredClone(marketDoc);
  bad.listings[0].canonicalProductId=null;
  const r=assessPricePairReadiness({marketplaceDocuments:[bad],supplierDocuments:[supplierDoc]});
  assert.equal(r.marketplace.priceReady,0);
  assert.equal(r.pairs.pricePairCount,0);
  assert.equal(r.blockerCounts.MARKETPLACE_CANONICAL_ID_UNRESOLVED,1);
});
