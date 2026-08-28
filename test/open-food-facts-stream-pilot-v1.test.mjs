import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_OFF_CSV_URL,
  assertOfficialOffSource,
  buildHeaderIndex,
  projectOffTsvLine,
  summarizeOfficialOffPilot,
  buildDeterministicReviewSample,
  evaluateOffTenKDryRun
} from '../open-food-facts-stream-pilot-v1.js';

test('official source is pinned to Open Food Facts bulk export',()=>{
  assert.equal(assertOfficialOffSource(OFFICIAL_OFF_CSV_URL),true);
  assert.throws(()=>assertOfficialOffSource('https://example.com/data.csv.gz'),/OFFICIAL_OFF_SOURCE_REQUIRED/);
});

test('header projection reads explicit catalogue fields when present',()=>{
  const header='code\tproduct_name\tbrands\tcategories\timage_front_url\timage_url\tquantity\tcountries\tnutriscore_grade\tlast_modified_datetime';
  const index=buildHeaderIndex(header);
  assert.equal(index.valid,true);
  const row=projectOffTsvLine('4006381333931\tAlpha\tAcme\tFood\thttps://a\thttps://b\t1 kg\tRomania\ta\t2026-08-27T00:00:00Z',index);
  assert.equal(row.code,'4006381333931');
  assert.equal(row.product_name,'Alpha');
  assert.equal(row.image_front_url,'https://a');
});

test('missing required identity columns fail closed',()=>{
  const index=buildHeaderIndex('code\tbrands\tcategories');
  assert.equal(index.valid,false);
  assert.ok(index.missing.includes('product_name'));
  assert.equal(projectOffTsvLine('4006381333931\tAcme\tFood',index),null);
});

test('pilot summary distinguishes syntactic GTIN from checksum-valid GTIN',()=>{
  const rows=[{code:'4006381333931',product_name:'Valid'},{code:'4006381333932',product_name:'Invalid checksum'},{code:'ABC',product_name:'Non GTIN'}];
  const out=summarizeOfficialOffPilot({rows,minRows:3});
  assert.equal(out.decision,'PILOT_SAMPLE_ACQUIRED');
  assert.equal(out.metrics.syntacticIdentityRows,2);
  assert.equal(out.metrics.validChecksumIdentityRows,1);
  assert.equal(out.metrics.invalidChecksumIdentityRows,1);
  assert.equal(out.metrics.uniqueValidGtinCount,1);
});

test('pilot summary remains zero-cost and does not authorize commercial use',()=>{
  const out=summarizeOfficialOffPilot({rows:[{code:'4006381333931',product_name:'P1'}],minRows:10});
  assert.equal(out.decision,'HOLD_PILOT_SAMPLE');
  assert.equal(out.policy.providerDataSpendEur,0);
  assert.equal(out.policy.paidDataCallsTriggered,0);
  assert.equal(out.policy.purchaseAuthorized,false);
  assert.equal(out.policy.verifiedSalesRows,0);
  assert.equal(out.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(out.policy.commercialUseAuthorized,false);
});

test('review sample is deterministic and can be strong-identity-only',()=>{
  const candidates=[
    {fingerprint:'b',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'2',title:'B',gtin:'4006381333931',identityStrength:'STRONG_GTIN',evidenceClass:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',rankingEligible:false,commercialEligible:false,salesEvidenceClass:'NOT_VERIFIED_SALES'},
    {fingerprint:'a',sourceKey:'OPEN_FOOD_FACTS',sourceRecordId:'1',title:'A',gtin:'5901234123457',identityStrength:'STRONG_GTIN',evidenceClass:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',rankingEligible:false,commercialEligible:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}
  ];
  const sample=buildDeterministicReviewSample(candidates,2);
  assert.deepEqual(sample.map(x=>x.fingerprint),['a','b']);
  assert.ok(sample.every(x=>x.identityStrength==='STRONG_GTIN'));
  assert.ok(sample.every(x=>x.gtinValid===true));
  assert.ok(sample.every(x=>x.rankingEligible===false));
});

test('10K gate holds even when accepted count passes but strong identities do not',()=>{
  const pilot={decision:'PILOT_SAMPLE_ACQUIRED'};
  const ingestion={decision:'INGESTION_ACCOUNTED',stats:{input:24000,accepted:13221,held:10779,logicalDuplicates:291,strongIdentityProducts:6640,claimCount:35181,silentDrops:0},policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}};
  const reviewSample=Array.from({length:200},(_,i)=>({identityStrength:'STRONG_GTIN',gtinValid:true,fingerprint:String(i)}));
  const out=evaluateOffTenKDryRun({pilot,ingestion,reviewSample});
  assert.equal(out.decision,'HOLD_10K_DRY_RUN');
  assert.ok(out.reasons.includes('STRONG_IDENTITY_PRODUCTS_BELOW_10K'));
  assert.equal(out.productionScaleAuthorized,false);
});

test('10K dry-run readiness requires both accepted and strong identity thresholds',()=>{
  const pilot={decision:'PILOT_SAMPLE_ACQUIRED'};
  const ingestion={decision:'INGESTION_ACCOUNTED',stats:{input:48000,accepted:26000,held:22000,logicalDuplicates:500,strongIdentityProducts:13000,claimCount:60000,silentDrops:0},policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}};
  const reviewSample=Array.from({length:200},(_,i)=>({identityStrength:'STRONG_GTIN',gtinValid:true,fingerprint:String(i)}));
  const out=evaluateOffTenKDryRun({pilot,ingestion,reviewSample});
  assert.equal(out.decision,'TEN_K_DRY_RUN_EVIDENCE_READY');
  assert.equal(out.metrics.strongIdentityProducts,13000);
  assert.equal(out.productionScaleAuthorized,false);
  assert.equal(out.productionCatalogWriteAuthorized,false);
  assert.equal(out.commercialUseAuthorized,false);
  assert.equal(out.verifiedSalesRows,0);
  assert.match(out.fingerprint,/^[a-f0-9]{64}$/);
});

test('review sample contamination with fallback identity fails closed',()=>{
  const pilot={decision:'PILOT_SAMPLE_ACQUIRED'};
  const ingestion={decision:'INGESTION_ACCOUNTED',stats:{input:48000,accepted:26000,held:22000,logicalDuplicates:500,strongIdentityProducts:13000,claimCount:60000,silentDrops:0},policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'}};
  const reviewSample=Array.from({length:200},(_,i)=>({identityStrength:i===0?'FALLBACK':'STRONG_GTIN',gtinValid:i!==0,fingerprint:String(i)}));
  const out=evaluateOffTenKDryRun({pilot,ingestion,reviewSample});
  assert.equal(out.decision,'HOLD_10K_DRY_RUN');
  assert.ok(out.reasons.includes('REVIEW_SAMPLE_NOT_STRONG_IDENTITY_ONLY'));
});
