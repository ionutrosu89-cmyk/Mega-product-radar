import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductFingerprint} from '../product-fingerprint-v1.js';
import {matchMarketplaceToSupplier,tokenJaccardSimilarity,MatchingEngineV1Policy} from '../marketplace-supplier-matching-v1.js';

const product=overrides=>buildProductFingerprint({
  category:'home',
  productType:'beach towel',
  primaryFunction:'beach drying',
  packCount:4,
  material:'100% cotton',
  dimensions:{lengthCm:180,widthCm:100},
  unitWeightGrams:400,
  formFactor:'towel',
  sourceTitle:'oversized cotton beach towels pack of 4 180x100',
  technicalSpecs:{gsm:400},
  ...overrides
});

test('near-identical marketplace and supplier products clear screening threshold',()=>{
  const marketplace=product({});
  const supplier=product({sourceTitle:'4 pack oversized cotton beach towel 100 x 180'});
  const result=matchMarketplaceToSupplier(marketplace,supplier);
  assert.equal(result.hardMismatches.length,0);
  assert.ok(result.matchConfidence>=80);
  assert.equal(result.screeningEconomicsEligible,true);
  assert.ok(['NEAR_EXACT_MATCH','HIGH_CONFIDENCE_MATCH','ACCEPTABLE_SCREENING_MATCH'].includes(result.matchClass));
});

test('different pack count is rejected even with a very similar title',()=>{
  const marketplace=product({packCount:4,sourceTitle:'oversized cotton beach towels pack of 4'});
  const supplier=product({packCount:2,sourceTitle:'oversized cotton beach towels pack of 4'});
  const result=matchMarketplaceToSupplier(marketplace,supplier);
  assert.equal(result.matchConfidence,0);
  assert.equal(result.matchClass,'REJECTED_MATCH');
  assert.equal(result.screeningEconomicsEligible,false);
  assert.ok(result.hardMismatches.includes('PACK_COUNT_MISMATCH'));
});

test('microfiber near-miss cannot match cotton listing',()=>{
  const result=matchMarketplaceToSupplier(product({material:'100% cotton'}),product({material:'microfiber'}));
  assert.equal(result.matchClass,'REJECTED_MATCH');
  assert.ok(result.hardMismatches.includes('MATERIAL_MISMATCH'));
});

test('materially different dimensions force rejection',()=>{
  const result=matchMarketplaceToSupplier(product({dimensions:{lengthCm:180,widthCm:100}}),product({dimensions:{lengthCm:140,widthCm:70}}));
  assert.equal(result.matchClass,'REJECTED_MATCH');
  assert.ok(result.hardMismatches.includes('DIMENSION_MISMATCH'));
});

test('unknown attributes do not become implicit matches or zeros',()=>{
  const sparseA=buildProductFingerprint({productType:'beach towel',sourceTitle:'cotton beach towel'});
  const sparseB=buildProductFingerprint({productType:'beach towel',sourceTitle:'cotton beach towel'});
  const result=matchMarketplaceToSupplier(sparseA,sparseB);
  assert.ok(result.evidence.some(e=>e.status==='UNKNOWN'));
  assert.equal(result.truthPolicy.unknownFeatureCountsAsMatch,false);
  assert.equal(result.truthPolicy.unknownFeatureCountsAsZero,false);
  assert.equal(result.screeningEconomicsEligible,false);
});

test('semantic similarity is deterministic but never overrides hard identity gates',()=>{
  const similarity=tokenJaccardSimilarity('oversized cotton beach towels pack 4','pack 4 oversized cotton beach towels');
  assert.equal(similarity,1);
  const result=matchMarketplaceToSupplier(product({packCount:4}),product({packCount:2}));
  assert.equal(result.matchClass,'REJECTED_MATCH');
  assert.equal(MatchingEngineV1Policy.semanticSimilarityAloneIsSufficient,false);
});

test('screening threshold can be raised but never bypasses hard mismatch',()=>{
  const same=matchMarketplaceToSupplier(product({}),product({}),{screeningThreshold:95});
  assert.equal(same.screeningEconomicsEligible,true);
  const mismatch=matchMarketplaceToSupplier(product({packCount:4}),product({packCount:3}),{screeningThreshold:1});
  assert.equal(mismatch.screeningEconomicsEligible,false);
});
