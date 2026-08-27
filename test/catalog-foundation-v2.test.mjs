import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSourceUse,getSourceRightsProfile} from '../source-rights-registry-v2.js';
import {normalizeGtin,isValidGtin,strongIdentityKeys,resolveCandidatePair} from '../canonical-identity-v2.js';
import {adaptOpenFactsRecord,adaptEprelRecord,buildCatalogBatch} from '../catalog-source-adapters-v1.js';

test('Open Food Facts is analysis allowed but commercial use remains held',()=>{
  const a=evaluateSourceUse('OPEN_FOOD_FACTS',{intendedUse:'analysis'});
  const c=evaluateSourceUse('OPEN_FOOD_FACTS',{intendedUse:'commercial'});
  assert.equal(a.decision,'ACCEPT');
  assert.equal(c.decision,'HOLD');
  assert.equal(getSourceRightsProfile('OPEN_FOOD_FACTS').commercialUseAllowed,false);
});

test('unreviewed sources fail closed',()=>{
  const r=evaluateSourceUse('OPEN_ICECAT',{intendedUse:'analysis'});
  assert.equal(r.decision,'HOLD');
  assert.ok(r.reasons.includes('SOURCE_RIGHTS_REVIEW_INCOMPLETE'));
});

test('GTIN normalization and checksum work',()=>{
  assert.equal(normalizeGtin('4006381333931'),'04006381333931');
  assert.equal(isValidGtin('4006381333931'),true);
  assert.equal(isValidGtin('4006381333932'),false);
});

test('strong identity dedupes EAN/UPC into GTIN namespace',()=>{
  const keys=strongIdentityKeys({ean:'4006381333931',gtin:'04006381333931'});
  assert.equal(keys.filter(x=>x.namespace==='GTIN').length,1);
});

test('hard variant conflict overrides fuzzy similarity',()=>{
  const a={brand:'Acme',title:'Acme Bottle',model:'X1',capacity:'500 ml'};
  const b={brand:'Acme',title:'Acme Bottle',model:'X1',capacity:'1 L'};
  const r=resolveCandidatePair(a,b);
  assert.equal(r.decision,'KEEP_SEPARATE');
  assert.ok(r.reasons.includes('HARD_CONFLICT_CAPACITY'));
});

test('OpenFacts adapter remains catalogue-only and NOT_VERIFIED_SALES',()=>{
  const c=adaptOpenFactsRecord({code:'4006381333931',product_name:'Test Food',brands:'Acme'});
  assert.equal(c.canonicalCandidate,true);
  assert.equal(c.rankingEligible,false);
  assert.equal(c.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(c.purchaseAuthorized,false);
});

test('EPREL adapter can use official registry id as strong scoped identity',()=>{
  const c=adaptEprelRecord({registrationNumber:'123456',commercialName:'Eco Fridge',supplierName:'Acme',modelIdentifier:'EF-1'});
  assert.equal(c.identityStrength,'STRONG_SOURCE_REGISTRY');
  assert.ok(c.identityKeys.some(x=>x.namespace==='EPREL'));
});

test('catalog batch rejects logical duplicate without inflating accepted count',()=>{
  const rows=[
    {code:'4006381333931',product_name:'A',brands:'Acme'},
    {code:'4006381333931',product_name:'A duplicate',brands:'Acme'},
    {code:'5012345678900',product_name:'B',brands:'Acme'}
  ];
  const batch=buildCatalogBatch(rows,adaptOpenFactsRecord);
  assert.equal(batch.stats.input,3);
  assert.equal(batch.stats.accepted,2);
  assert.equal(batch.stats.logicalDuplicates,1);
  assert.equal(batch.policy.providerDataSpendEur,0);
  assert.equal(batch.policy.paidDataCallsTriggered,0);
  assert.equal(batch.policy.purchaseAuthorized,false);
});
