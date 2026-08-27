import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRankingSignalBundle,attachTrustedRankingSignals,rankingIdentityKey} from '../ranking-signal-ingestion-v1.js';

const sha='a'.repeat(64);

function eventResult(overrides={}){
  const envelope={
    expectedIdentity:{marketplace:'AMAZON',externalId:'B012345678'},
    observedIdentity:{marketplace:'AMAZON',externalId:'B012345678'},
    source:{name:'TEST_SOURCE',url:'https://example.test/product',observedAt:'2026-08-27T10:00:00.000Z'},
    provenance:{collector:'test-collector',runId:'RUN_1',artifactId:'A1',contentSha256:sha},
    sourceRights:{analysisAllowed:true,commercialUseAllowed:false},
    evidenceStrength:'STRONG',
    evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    payload:{rank:123}
  };
  return{
    envelope:{...envelope,...(overrides.envelope||{})},
    policy:{decision:'ACCEPT',reasons:[],...(overrides.policy||{})}
  };
}

test('ranking identity key requires marketplace and exact external id',()=>{
  assert.equal(rankingIdentityKey({marketplace:' amazon ',externalId:' b012345678 '}),'AMAZON:B012345678');
  assert.equal(rankingIdentityKey({marketplace:'AMAZON'}),null);
});

test('accepted explicit rank evidence becomes trusted ranking signal',()=>{
  const bundle=buildRankingSignalBundle([eventResult()],{runId:'RUN_1'});
  assert.equal(bundle.manifest.trustedCount,1);
  assert.equal(bundle.manifest.heldCount,0);
  assert.equal(bundle.manifest.providerDataSpendEur,0);
  assert.equal(bundle.manifest.paidDataCallsTriggered,0);
  assert.equal(bundle.manifest.purchaseAuthorized,false);
  assert.equal(bundle.trustedRecords[0].identityKey,'AMAZON:B012345678');
});

test('policy HOLD never becomes trusted ranking signal',()=>{
  const bundle=buildRankingSignalBundle([eventResult({policy:{decision:'HOLD',reasons:['TEST_HOLD']}})]);
  assert.equal(bundle.manifest.trustedCount,0);
  assert.equal(bundle.manifest.heldCount,1);
  assert.ok(bundle.heldRecords[0].eligibilityReasons.includes('POLICY_KERNEL_ACCEPT_REQUIRED'));
});

test('catalogue bootstrap evidence remains held even when policy is ACCEPT',()=>{
  const bundle=buildRankingSignalBundle([eventResult({envelope:{evidenceClass:'OPEN_PUBLIC_DATASET_PRODUCT'}})]);
  assert.equal(bundle.manifest.trustedCount,0);
  assert.ok(bundle.heldRecords[0].eligibilityReasons.includes('CATALOGUE_EVIDENCE_NOT_RANKING_SIGNAL'));
});

test('missing provenance cannot become trusted ranking signal',()=>{
  const bundle=buildRankingSignalBundle([eventResult({envelope:{provenance:{collector:'test-collector',runId:'RUN_1',contentSha256:null}}})]);
  assert.equal(bundle.manifest.trustedCount,0);
  assert.ok(bundle.heldRecords[0].eligibilityReasons.includes('PROVENANCE_REQUIRED'));
});

test('trusted signals attach only to exact same marketplace and external id',()=>{
  const bundle=buildRankingSignalBundle([eventResult()]);
  const products=[
    {platform:'AMAZON',asin:'B012345678'},
    {platform:'AMAZON',asin:'B999999999'},
    {platform:'EBAY',externalId:'B012345678'}
  ];
  const report=attachTrustedRankingSignals(products,bundle);
  assert.equal(report.matchedProductCount,1);
  assert.equal(report.attachedSignalCount,1);
  assert.equal(report.crossPlatformAutoMerge,false);
  assert.equal(products[0].rankingEvidence.length,1);
  assert.equal(products[1].rankingEvidence,undefined);
  assert.equal(products[2].rankingEvidence,undefined);
});

test('attaching the same bundle twice is idempotent',()=>{
  const bundle=buildRankingSignalBundle([eventResult()]);
  const products=[{platform:'AMAZON',asin:'B012345678'}];
  attachTrustedRankingSignals(products,bundle);
  const second=attachTrustedRankingSignals(products,bundle);
  assert.equal(products[0].rankingEvidence.length,1);
  assert.equal(second.attachedSignalCount,0);
});
