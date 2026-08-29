import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptStructuredSupplierProviderRow,adaptStructuredSupplierProviderRows} from '../structured-supplier-provider-adapter-v1.js';
import {generateSupplierCandidates,runOpportunityFunnel} from '../opportunity-funnel-v1.js';

test('structured supplier adapter preserves conservative public price range and MOQ tiers',()=>{
  const row=adaptStructuredSupplierProviderRow({productId:'1601234567890',productUrl:'https://www.alibaba.com/product-detail/Test_1601234567890.html',title:'Cotton towel pack of 4',priceRange:'US $2.10-3.40',minOrderQuantity:20,priceUnit:'set',quantityPrices:[{minQuantity:20,price:3.4},{minQuantity:100,price:2.8}]},{provider:'APIFY_COMPAT'});
  assert.equal(row.valid,true);
  assert.equal(row.normalizedObservation.currency,'USD');
  assert.equal(row.normalizedObservation.publicPriceMin,2.1);
  assert.equal(row.normalizedObservation.publicPriceMax,3.4);
  assert.equal(row.normalizedObservation.moq,20);
  assert.equal(row.normalizedObservation.priceTiers.length,2);
  assert.equal(row.truthPolicy.publicSupplierPriceIsLandedCost,false);
});

test('provider rows without observable public price fail closed',()=>{
  const out=adaptStructuredSupplierProviderRows([{productId:'x',productUrl:'https://www.alibaba.com/product-detail/x.html',title:'Unknown price item'}]);
  assert.equal(out.observations.length,0);
  assert.equal(out.rejected.length,1);
  assert.ok(out.rejected[0].blockers.includes('PUBLIC_PRICE_REQUIRED'));
});

test('candidate generation does not claim a match',()=>{
  const pairs=generateSupplierCandidates([{listingKey:'AMAZON:A1',title:'cotton beach towel pack 4'}],[{supplierListingId:'S1',title:'cotton beach towel pack 4'}]);
  assert.equal(pairs.length,1);
  assert.equal(pairs[0].evidenceClass,'SUPPLIER_CANDIDATE_PAIR_ONLY');
  assert.equal(pairs[0].truthPolicy.candidatePairIsMatch,false);
});

test('opportunity funnel screens only a sufficiently evidenced >=80 match',()=>{
  const marketplace=[{listingKey:'AMAZON:A1',title:'cotton beach towel pack 4 180 x 100 cm',category:'towel',productType:'beach towel',primaryFunction:'drying',packCount:4,material:'cotton',dimensions:{lengthCm:180,widthCm:100},unitWeightGrams:500,formFactor:'rectangular',snapshots:[{price:200,currency:'RON',sourceUrl:'https://amazon.example/A1'}]}];
  const supplier=[{supplierListingId:'S1',supplierListingKey:'ALIBABA:S1',title:'cotton beach towel pack 4 180 x 100 cm',category:'towel',productType:'beach towel',primaryFunction:'drying',packCount:4,material:'cotton',dimensions:{lengthCm:180,widthCm:100},unitWeightGrams:500,formFactor:'rectangular',publicPriceMax:12,currency:'USD',sourceUrl:'https://alibaba.example/S1'}];
  const assumptions={supplierFxToRon:4.6,marketplaceFxToRon:1,freightPerUnitRon:15,insurancePerUnitRon:1,dutyRate:0.12,importVatRate:0.21,importVatRecoverable:true,brokeragePerUnitRon:2,destinationHandlingPerUnitRon:2,domesticTransportPerUnitRon:3,packagingPerUnitRon:2,complianceReservePerUnitRon:1,importVatAdditionalBasePerUnitRon:0,sellVatRate:0.21,marketplaceCommissionRate:0.15,fulfillmentPerUnitRon:8,adsReserveRate:0.05,returnsReserveRate:0.03,warrantyReserveRate:0.01,otherReserveRate:0.01,freightAssumptionRef:'profile://freight-test',dutyAssumptionRef:'profile://duty-test',marketplaceFeeAssumptionRef:'profile://fees-test'};
  const out=runOpportunityFunnel({marketplaceListings:marketplace,supplierListings:supplier,assumptions,topN:10});
  assert.equal(out.candidatePairCount,1);
  assert.equal(out.screeningEligibleMatchCount,1);
  assert.equal(out.screenedCount,1);
  assert.equal(out.topOpportunities.length,1);
  assert.equal(out.topOpportunities[0].economics.rankingScenario,'CONSERVATIVE');
  assert.equal(out.truthPolicy.screeningEstimateIsConfirmedEconomics,false);
});

test('title similarity alone does not unlock economics',()=>{
  const marketplace=[{listingKey:'AMAZON:A2',title:'white noise machine baby sleep',snapshots:[{price:150,currency:'RON',sourceUrl:'https://amazon.example/A2'}]}];
  const supplier=[{supplierListingId:'S2',title:'white noise machine baby sleep',publicPriceMax:8,currency:'USD',sourceUrl:'https://alibaba.example/S2'}];
  const out=runOpportunityFunnel({marketplaceListings:marketplace,supplierListings:supplier,assumptions:{supplierFxToRon:4.6,marketplaceFxToRon:1}});
  assert.equal(out.candidatePairCount,1);
  assert.equal(out.screeningEligibleMatchCount,0);
  assert.equal(out.screenedCount,0);
});
