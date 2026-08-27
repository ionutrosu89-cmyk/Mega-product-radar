import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSourceManifest,buildProductClaims,runBulkCatalogIngestion,
  evaluateTenKCatalogGate,calibrateIdentityDecisions
} from '../bulk-catalog-ingestion-v1.js';

const rows=[
  {code:'4006381333931',product_name:'Alpha 500 ml',brands:'Acme',categories:'Drinks'},
  {code:'4006381333931',product_name:'Alpha duplicate',brands:'Acme',categories:'Drinks'},
  {code:'5901234123457',product_name:'Beta 1 L',brands:'Acme',categories:'Drinks'}
];

test('source manifest is deterministic for identical input',()=>{
  const a=createSourceManifest({sourceKey:'OPEN_FOOD_FACTS',records:rows,retrievedAt:'2026-08-27T16:00:00Z',artifactRef:'fixture.json'});
  const b=createSourceManifest({sourceKey:'OPEN_FOOD_FACTS',records:rows,retrievedAt:'2026-08-27T16:00:00Z',artifactRef:'fixture.json'});
  assert.equal(a.manifestSha256,b.manifestSha256);
  assert.equal(a.recordsSha256,b.recordsSha256);
});

test('bulk ingestion accounts for every row and deduplicates strong identities',()=>{
  const out=runBulkCatalogIngestion({sourceKey:'OPEN_FOOD_FACTS',records:rows,retrievedAt:'2026-08-27T16:00:00Z'});
  assert.equal(out.schema,'MPR_BULK_CATALOG_INGESTION_V1');
  assert.equal(out.stats.input,3);
  assert.equal(out.stats.accepted,2);
  assert.equal(out.stats.held,1);
  assert.equal(out.stats.logicalDuplicates,1);
  assert.equal(out.stats.silentDrops,0);
  assert.equal(out.decision,'INGESTION_ACCOUNTED');
  assert.equal(out.policy.providerDataSpendEur,0);
  assert.equal(out.policy.paidDataCallsTriggered,0);
  assert.equal(out.policy.purchaseAuthorized,false);
  assert.equal(out.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.ok(out.claims.length>0);
  assert.match(out.checkpoint.checkpointSha256,/^[a-f0-9]{64}$/);
});

test('existing strong identities are held instead of silently duplicated',()=>{
  const out=runBulkCatalogIngestion({sourceKey:'OPEN_FOOD_FACTS',records:[rows[0]],retrievedAt:'2026-08-27T16:00:00Z'},{existingIdentityKeys:['GTIN:04006381333931']});
  assert.equal(out.stats.accepted,0);
  assert.equal(out.stats.held,1);
  assert.equal(out.held[0].holdReason,'EXISTING_LOGICAL_DUPLICATE');
});

test('claims preserve source and analysis-only truth class',()=>{
  const out=runBulkCatalogIngestion({sourceKey:'OPEN_FOOD_FACTS',records:[rows[0]],retrievedAt:'2026-08-27T16:00:00Z'});
  const claims=buildProductClaims(out.accepted[0]);
  assert.ok(claims.some(x=>x.field==='gtin'));
  assert.ok(claims.every(x=>x.sourceKey==='OPEN_FOOD_FACTS'));
  assert.ok(claims.every(x=>x.evidenceClass==='CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY'));
});

test('identity calibration exposes review/merge decisions without changing products',()=>{
  const candidates=[
    {brand:'Acme',title:'Widget Pro 128 GB',model:'WP1',fingerprint:'a'},
    {brand:'Acme',title:'Widget Pro 128GB',model:'WP1',fingerprint:'b'},
    {brand:'Other',title:'Different',model:'X',fingerprint:'c'}
  ];
  const out=calibrateIdentityDecisions(candidates,{sampleLimit:10});
  assert.equal(out.schema,'MPR_IDENTITY_CALIBRATION_V1');
  assert.ok(out.autoMerge>=1);
});

test('10k gate fails closed without real restore and replay evidence',()=>{
  const gate=evaluateTenKCatalogGate({canonicalCount:10000,logicalDuplicateCount:0,provenanceComplete:true,replayDeterministic:false,checkpointRestoreVerified:false,silentDrops:0,syntheticCount:0,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false});
  assert.equal(gate.decision,'HOLD_10K');
  assert.ok(gate.reasons.includes('REPLAY_NOT_DETERMINISTIC'));
  assert.ok(gate.reasons.includes('CHECKPOINT_RESTORE_NOT_VERIFIED'));
});

test('10k gate can pass only when all explicit conditions pass',()=>{
  const gate=evaluateTenKCatalogGate({canonicalCount:10000,logicalDuplicateCount:10,provenanceComplete:true,replayDeterministic:true,checkpointRestoreVerified:true,silentDrops:0,syntheticCount:0,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false});
  assert.equal(gate.decision,'TEN_K_READY');
  assert.ok(gate.metrics.duplicateRate<0.005);
});
