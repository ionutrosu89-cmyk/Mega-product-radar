import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductFingerprint} from '../product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from '../marketplace-supplier-matching-v1.js';

const fp=input=>buildProductFingerprint(input);
const tech=result=>result.evidence.find(x=>x.feature==='technicalSpecs');

test('one-sided distinctive technical spec is partial evidence, not a full match',()=>{
  const marketplace=fp({
    productType:'desk organizer',primaryFunction:'desk file organization',packCount:1,material:'metal',
    dimensions:{lengthCm:30.48,widthCm:34.976,heightCm:27.94},unitWeightGrams:1814,
    technicalSpecs:{tiers:5,penHolders:2},sourceTitle:'5 tier desk organizer with 2 pen holders'
  });
  const supplier=fp({
    productType:'desk organizer',primaryFunction:'desk file organization',packCount:1,material:'metal',
    dimensions:{lengthCm:30,widthCm:32,heightCm:28.5},unitWeightGrams:1700,
    technicalSpecs:{tiers:5},sourceTitle:'5 tier desk organizer'
  });
  const result=matchMarketplaceToSupplier(marketplace,supplier,{screeningThreshold:80});
  assert.equal(tech(result).status,'PARTIAL');
  assert.equal(tech(result).similarity,0.5);
  assert.equal(tech(result).points,3.5);
  assert.equal(result.truthPolicy.technicalSpecMissingOnOneSideCountsAsConfirmedMatch,false);
});

test('matching known technical spec sets still receive full technical-spec credit',()=>{
  const marketplace=fp({productType:'desk organizer',technicalSpecs:{tiers:5,penHolders:2},sourceTitle:'organizer'});
  const supplier=fp({productType:'desk organizer',technicalSpecs:{tiers:5,penHolders:2},sourceTitle:'organizer'});
  const result=matchMarketplaceToSupplier(marketplace,supplier);
  assert.equal(tech(result).status,'MATCH');
  assert.equal(tech(result).similarity,1);
  assert.equal(tech(result).points,7);
});

test('technical spec sets with no shared keys stay UNKNOWN rather than becoming mismatch',()=>{
  const marketplace=fp({productType:'desk organizer',technicalSpecs:{penHolders:2},sourceTitle:'organizer'});
  const supplier=fp({productType:'desk organizer',technicalSpecs:{tiers:5},sourceTitle:'organizer'});
  const result=matchMarketplaceToSupplier(marketplace,supplier);
  assert.equal(tech(result).status,'UNKNOWN');
  assert.equal(tech(result).similarity,null);
  assert.equal(tech(result).points,0);
  assert.equal(result.hardMismatches.includes('TECHNICAL_SPEC_MISMATCH'),false);
});
