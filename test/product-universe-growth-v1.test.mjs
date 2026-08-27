import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmazonIdentity,normalizeUniverseCandidate,buildUniverseBatch,evaluateUniverseGrowth,HF_SOURCE_KEY} from '../product-universe-growth-v1.js';
import {getSourceRights} from '../source-rights-registry-v1.js';

test('registered MIT dataset is analysis-only, not commercial',()=>{
  const rights=getSourceRights(HF_SOURCE_KEY);
  assert.equal(rights.analysisAllowed,true);
  assert.equal(rights.commercialUseAllowed,false);
  assert.equal(rights.status,'ANALYSIS_ALLOWED');
});

test('Amazon identity is exact and marketplace-specific',()=>{
  assert.deepEqual(parseAmazonIdentity('https://www.amazon.in/dp/B0ABC12345'),{marketplace:'AMAZON_IN',asin:'B0ABC12345',canonicalKey:'AMAZON:AMAZON_IN:B0ABC12345'});
  assert.equal(parseAmazonIdentity('https://example.com/product/B0ABC12345'),null);
});

test('candidate normalization remains catalogue-only and NOT_VERIFIED_SALES',()=>{
  const result=normalizeUniverseCandidate({name:'Test product',link:'https://www.amazon.in/dp/B0ABC12345',ratings:'4.5',no_of_ratings:'123',discount_price:'₹999'});
  assert.equal(result.accepted,true);
  assert.equal(result.candidate.rankingEligible,false);
  assert.equal(result.candidate.commercialUseAllowed,false);
  assert.equal(result.candidate.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(result.candidate.purchaseAuthorized,false);
  assert.equal(result.candidate.providerDataSpendEur,0);
  assert.equal(result.candidate.price,999);
});

test('missing numeric fields remain null instead of fabricated zero',()=>{
  const result=normalizeUniverseCandidate({name:'No price',link:'https://www.amazon.com/dp/B0ABC12345'});
  assert.equal(result.accepted,true);
  assert.equal(result.candidate.price,null);
  assert.equal(result.candidate.rating,null);
  assert.equal(result.candidate.reviewCount,null);
});

test('unreviewed source cannot enter analysis universe',()=>{
  const result=normalizeUniverseCandidate({name:'Test',link:'https://www.amazon.com/dp/B0ABC12345'},{sourceKey:'UNKNOWN_SOURCE'});
  assert.equal(result.accepted,false);
  assert.equal(result.reason,'SOURCE_ANALYSIS_RIGHTS_REQUIRED');
});

test('universe batch rejects logical duplicates without inflating accepted count',()=>{
  const rows=[
    {name:'A',link:'https://www.amazon.in/dp/B0ABC12345'},
    {name:'A duplicate',link:'https://www.amazon.in/dp/B0ABC12345'},
    {name:'B',link:'https://www.amazon.in/dp/B0ABC12346'}
  ];
  const batch=buildUniverseBatch(rows);
  assert.equal(batch.acceptedCount,2);
  assert.equal(batch.logicalDuplicateCount,1);
  assert.equal(batch.commercialUseAllowed,false);
});

test('candidate batches do not authorize the 10K production stage',()=>{
  const growth=evaluateUniverseGrowth({currentCanonicalCount:100,candidateBatchCount:12000,target:10000});
  assert.equal(growth.projectedCanonicalCount,12100);
  assert.equal(growth.stageDecision,'HOLD_10K_CANONICAL');
  assert.equal(growth.candidateImportCanOnlySupportAnalysis,true);
});
